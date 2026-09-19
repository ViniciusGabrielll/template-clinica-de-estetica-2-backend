import pool from "../config/database.js";

export async function createAppointment(req, res) {
    try {
        const {
            service_ids,
            customer_name,
            customer_phone,
            appointment_date,
            start_time
        } = req.body;

        if (
            !Array.isArray(service_ids) ||
            service_ids.length === 0 ||
            !customer_name ||
            !customer_phone ||
            !appointment_date ||
            !start_time
        ) {
            return res.status(400).json({
                message: "Preencha todos os campos obrigatórios."
            });
        }

        const uniqueServiceIds = [
            ...new Set(
                service_ids.map(Number).filter(Boolean)
            )
        ];

        if (uniqueServiceIds.length === 0) {
            return res.status(400).json({
                message: "Selecione pelo menos um serviço."
            });
        }

        const placeholders = uniqueServiceIds
            .map(() => "?")
            .join(",");

        const [services] = await pool.query(
            `
            SELECT id, name, duration, price
            FROM services
            WHERE id IN (${placeholders})
            AND active = TRUE
            `,
            uniqueServiceIds
        );

        if (services.length !== uniqueServiceIds.length) {
            return res.status(400).json({
                message: "Um ou mais serviços selecionados não estão disponíveis."
            });
        }

        const [promotions] = await pool.query(
            `
            SELECT service_id, promotional_price
            FROM promotions
            WHERE service_id IN (${placeholders})
            AND expires_at > NOW()
            `,
            uniqueServiceIds
        );

        const promotionsMap = new Map(
            promotions.map((promotion) => [
                Number(promotion.service_id),
                Number(promotion.promotional_price)
            ])
        );

        const totalDuration = services.reduce(
            (total, service) =>
                total + Number(service.duration),
            0
        );

        const originalTotalPrice = services.reduce(
            (total, service) =>
                total + Number(service.price),
            0
        );

        const totalPrice = services.reduce(
            (total, service) => {
                const promotionalPrice =
                    promotionsMap.get(Number(service.id));

                const price =
                    promotionalPrice !== undefined
                        ? promotionalPrice
                        : Number(service.price);

                return total + price;
            },
            0
        );

        const [businessHours] = await pool.query(
            `
            SELECT opening_time, closing_time
            FROM business_hours
            WHERE day_of_week = DAYOFWEEK(?) - 1
            AND active = TRUE
            ORDER BY opening_time ASC
            LIMIT 1
            `,
            [appointment_date]
        );

        if (businessHours.length === 0) {
            return res.status(400).json({
                message: "A clínica não funciona neste dia."
            });
        }

        const openingTime = String(
            businessHours[0].opening_time
        ).slice(0, 5);

        const closingTime = String(
            businessHours[0].closing_time
        ).slice(0, 5);

        const [startHour, startMinute] =
            String(start_time)
                .slice(0, 5)
                .split(":")
                .map(Number);

        const startMinutes =
            startHour * 60 + startMinute;

        const endMinutes =
            startMinutes + totalDuration;

        const endHour =
            Math.floor(endMinutes / 60);

        const endMinute =
            endMinutes % 60;

        const normalizedStartTime =
            `${String(startHour).padStart(2, "0")}:${String(
                startMinute
            ).padStart(2, "0")}:00`;

        const endTime =
            `${String(endHour).padStart(2, "0")}:${String(
                endMinute
            ).padStart(2, "0")}:00`;

        if (
            normalizedStartTime.slice(0, 5) < openingTime ||
            endTime.slice(0, 5) > closingTime
        ) {
            return res.status(400).json({
                message: "O horário selecionado está fora do horário de funcionamento."
            });
        }

        const [blockedDates] = await pool.query(
            `
            SELECT id
            FROM blocked_dates
            WHERE date = ?
            LIMIT 1
            `,
            [appointment_date]
        );

        if (blockedDates.length > 0) {
            return res.status(400).json({
                message: "A clínica não funciona nesta data."
            });
        }

        const [conflicts] = await pool.query(
            `
            SELECT id
            FROM appointments
            WHERE appointment_date = ?
            AND status != 'cancelled'
            AND start_time < ?
            AND end_time > ?
            LIMIT 1
            `,
            [
                appointment_date,
                endTime,
                normalizedStartTime
            ]
        );

        if (conflicts.length > 0) {
            return res.status(409).json({
                message: "Este horário não está mais disponível."
            });
        }

        const connection =
            await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [appointmentResult] =
                await connection.query(
                    `
                    INSERT INTO appointments (
                        service_id,
                        customer_name,
                        customer_phone,
                        appointment_date,
                        start_time,
                        end_time,
                        original_total_price,
                        total_price,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
                    `,
                    [
                        uniqueServiceIds[0],
                        customer_name,
                        customer_phone,
                        appointment_date,
                        normalizedStartTime,
                        endTime,
                        originalTotalPrice,
                        totalPrice
                    ]
                );

            const appointmentId =
                appointmentResult.insertId;

            const appointmentServicesValues =
                uniqueServiceIds.map((serviceId) => [
                    appointmentId,
                    serviceId
                ]);

            await connection.query(
                `
                INSERT INTO appointment_services (
                    appointment_id,
                    service_id
                )
                VALUES ?
                `,
                [appointmentServicesValues]
            );

            await connection.commit();

            return res.status(201).json({
                message: "Agendamento realizado com sucesso.",
                appointment_id: appointmentId,
                total_duration: totalDuration,
                original_total_price:
                    originalTotalPrice,
                total_price: totalPrice,
                end_time: endTime
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(
            "Erro ao criar agendamento:",
            error
        );

        return res.status(500).json({
            message: "Erro ao criar agendamento."
        });
    }
}

export async function getAvailableTimes(req, res) {
    try {
        const {
            date,
            service_ids
        } = req.query;

        if (!date || !service_ids) {
            return res.status(400).json({
                message: "Data e serviços são obrigatórios."
            });
        }

        const serviceIds = String(service_ids)
            .split(",")
            .map(Number)
            .filter(Boolean);

        if (serviceIds.length === 0) {
            return res.status(400).json({
                message: "Selecione pelo menos um serviço."
            });
        }

        const placeholders = serviceIds
            .map(() => "?")
            .join(",");

        const [services] = await pool.query(
            `
            SELECT id, duration
            FROM services
            WHERE id IN (${placeholders})
            AND active = TRUE
            `,
            serviceIds
        );

        if (services.length !== serviceIds.length) {
            return res.status(400).json({
                message: "Um ou mais serviços não foram encontrados."
            });
        }

        const totalDuration = services.reduce(
            (total, service) =>
                total + Number(service.duration),
            0
        );

        const [businessHours] = await pool.query(
            `
            SELECT opening_time, closing_time
            FROM business_hours
            WHERE day_of_week = DAYOFWEEK(?) - 1
            AND active = TRUE
            ORDER BY opening_time ASC
            LIMIT 1
            `,
            [date]
        );

        if (businessHours.length === 0) {
            return res.json([]);
        }

        const openingTime = String(
            businessHours[0].opening_time
        ).slice(0, 5);

        const closingTime = String(
            businessHours[0].closing_time
        ).slice(0, 5);

        const [blockedDates] = await pool.query(
            `
            SELECT id
            FROM blocked_dates
            WHERE date = ?
            LIMIT 1
            `,
            [date]
        );

        if (blockedDates.length > 0) {
            return res.json([]);
        }

        const [appointments] = await pool.query(
            `
            SELECT start_time, end_time
            FROM appointments
            WHERE appointment_date = ?
            AND status != 'cancelled'
            `,
            [date]
        );

        const availableTimes = [];

        const [openingHour, openingMinute] =
            openingTime
                .split(":")
                .map(Number);

        const [closingHour, closingMinute] =
            closingTime
                .split(":")
                .map(Number);

        const openingMinutes =
            openingHour * 60 + openingMinute;

        const closingMinutes =
            closingHour * 60 + closingMinute;

        for (
            let minutes = openingMinutes;
            minutes + totalDuration <= closingMinutes;
            minutes += 30
        ) {
            const hours = Math.floor(
                minutes / 60
            );

            const mins = minutes % 60;

            const startTime =
                `${String(hours).padStart(
                    2,
                    "0"
                )}:${String(mins).padStart(
                    2,
                    "0"
                )}:00`;

            const endMinutes =
                minutes + totalDuration;

            const endHours =
                Math.floor(endMinutes / 60);

            const endMins =
                endMinutes % 60;

            const endTime =
                `${String(endHours).padStart(
                    2,
                    "0"
                )}:${String(endMins).padStart(
                    2,
                    "0"
                )}:00`;

            const hasConflict =
                appointments.some(
                    (appointment) => {
                        const appointmentStart =
                            String(
                                appointment.start_time
                            ).slice(0, 8);

                        const appointmentEnd =
                            String(
                                appointment.end_time
                            ).slice(0, 8);

                        return (
                            appointmentStart <
                                endTime &&
                            appointmentEnd >
                                startTime
                        );
                    }
                );

            if (!hasConflict) {
                availableTimes.push(
                    startTime.slice(0, 5)
                );
            }
        }

        return res.json(availableTimes);
    } catch (error) {
        console.error(
            "Erro ao buscar horários disponíveis:",
            error
        );

        return res.status(500).json({
            message:
                "Erro ao buscar horários disponíveis."
        });
    }
}

export async function getAppointments(req, res) {
    try {
        const [appointments] =
            await pool.query(
                `
                SELECT
                    a.id,
                    a.customer_name,
                    a.customer_phone,
                    a.appointment_date,
                    a.start_time,
                    a.end_time,
                    a.original_total_price,
                    a.total_price,
                    a.status,
                    COALESCE(
                        GROUP_CONCAT(
                            DISTINCT s2.name
                            ORDER BY s2.name
                            SEPARATOR ', '
                        ),
                        s1.name
                    ) AS service_name,
                    COALESCE(
                        (
                            SELECT SUM(s3.duration)
                            FROM appointment_services aps2
                            INNER JOIN services s3
                                ON s3.id = aps2.service_id
                            WHERE aps2.appointment_id = a.id
                        ),
                        s1.duration
                    ) AS duration
                FROM appointments a
                LEFT JOIN services s1
                    ON s1.id = a.service_id
                LEFT JOIN appointment_services aps
                    ON aps.appointment_id = a.id
                LEFT JOIN services s2
                    ON s2.id = aps.service_id
                GROUP BY
                    a.id,
                    a.customer_name,
                    a.customer_phone,
                    a.appointment_date,
                    a.start_time,
                    a.end_time,
                    a.original_total_price,
                    a.total_price,
                    a.status,
                    s1.name,
                    s1.duration
                ORDER BY
                    a.appointment_date ASC,
                    a.start_time ASC
                `
            );

        return res.json(appointments);
    } catch (error) {
        console.error(
            "Erro ao buscar agendamentos:",
            error
        );

        return res.status(500).json({
            message:
                "Erro ao buscar agendamentos."
        });
    }
}

export async function getAppointmentById(req, res) {
    try {
        const { id } = req.params;

        const [appointments] =
            await pool.query(
                `
                SELECT
                    a.id,
                    a.customer_name,
                    a.customer_phone,
                    a.appointment_date,
                    a.start_time,
                    a.end_time,
                    a.original_total_price,
                    a.total_price,
                    a.status,
                    COALESCE(
                        GROUP_CONCAT(
                            DISTINCT s2.name
                            ORDER BY s2.name
                            SEPARATOR ', '
                        ),
                        s1.name
                    ) AS service_name,
                    COALESCE(
                        (
                            SELECT SUM(s3.duration)
                            FROM appointment_services aps2
                            INNER JOIN services s3
                                ON s3.id = aps2.service_id
                            WHERE aps2.appointment_id = a.id
                        ),
                        s1.duration
                    ) AS duration
                FROM appointments a
                LEFT JOIN services s1
                    ON s1.id = a.service_id
                LEFT JOIN appointment_services aps
                    ON aps.appointment_id = a.id
                LEFT JOIN services s2
                    ON s2.id = aps.service_id
                WHERE a.id = ?
                GROUP BY
                    a.id,
                    a.customer_name,
                    a.customer_phone,
                    a.appointment_date,
                    a.start_time,
                    a.end_time,
                    a.original_total_price,
                    a.total_price,
                    a.status,
                    s1.name,
                    s1.duration
                `,
                [id]
            );

        if (appointments.length === 0) {
            return res.status(404).json({
                message: "Agendamento não encontrado."
            });
        }

        return res.json(appointments[0]);
    } catch (error) {
        console.error(
            "Erro ao buscar agendamento:",
            error
        );

        return res.status(500).json({
            message:
                "Erro ao buscar agendamento."
        });
    }
}

export async function updateAppointmentStatus(req, res) {
    const connection = await pool.getConnection();

    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = [
            "scheduled",
            "confirmed",
            "cancelled"
        ];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: "Status inválido."
            });
        }

        if (status === "cancelled") {
            await connection.beginTransaction();

            await connection.query(
                `
                DELETE FROM appointment_services
                WHERE appointment_id = ?
                `,
                [id]
            );

            const [result] = await connection.query(
                `
                DELETE FROM appointments
                WHERE id = ?
                `,
                [id]
            );

            if (result.affectedRows === 0) {
                await connection.rollback();

                return res.status(404).json({
                    message: "Agendamento não encontrado."
                });
            }

            await connection.commit();

            return res.json({
                message: "Agendamento cancelado e excluído com sucesso."
            });
        }

        const [result] = await connection.query(
            `
            UPDATE appointments
            SET status = ?
            WHERE id = ?
            `,
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Agendamento não encontrado."
            });
        }

        return res.json({
            message: "Status atualizado com sucesso."
        });
    } catch (error) {
        await connection.rollback();

        console.error(
            "Erro ao atualizar status:",
            error
        );

        return res.status(500).json({
            message: "Erro ao atualizar status."
        });
    } finally {
        connection.release();
    }
}

export async function deleteAppointment(req, res) {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `
            DELETE FROM appointments
            WHERE id = ?
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Agendamento não encontrado."
            });
        }

        return res.json({
            message:
                "Agendamento excluído com sucesso."
        });
    } catch (error) {
        console.error(
            "Erro ao excluir agendamento:",
            error
        );

        return res.status(500).json({
            message:
                "Erro ao excluir agendamento."
        });
    }
}

export async function deleteExpiredAppointments(req, res) {
    try {
        const [result] = await pool.query(
            `
            DELETE FROM appointments
            WHERE CONCAT(
                appointment_date,
                ' ',
                start_time
            ) < NOW()
            `
        );

        return res.json({
            message:
                "Agendamentos expirados excluídos.",
            deleted: result.affectedRows
        });
    } catch (error) {
        console.error(
            "Erro ao excluir agendamentos expirados:",
            error
        );

        return res.status(500).json({
            message:
                "Erro ao excluir agendamentos expirados."
        });
    }
}