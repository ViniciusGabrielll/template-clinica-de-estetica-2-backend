import pool from "../config/database.js";


/* =========================================================
   CRIAR AGENDAMENTO
========================================================= */

export async function createAppointment(req, res) {
    const {
        service_ids,
        customer_name,
        customer_phone,
        appointment_date,
        start_time,
    } = req.body;

    // -----------------------------------------------------
    // Validação
    // -----------------------------------------------------

    if (
        !Array.isArray(service_ids) ||
        service_ids.length === 0
    ) {
        return res.status(400).json({
            message: "Selecione pelo menos um serviço.",
        });
    }

    if (
        !customer_name ||
        !customer_phone ||
        !appointment_date ||
        !start_time
    ) {
        return res.status(400).json({
            message: "Preencha todos os campos obrigatórios.",
        });
    }

    // -----------------------------------------------------
    // Converte IDs para números e remove duplicados
    // -----------------------------------------------------

    const serviceIds = [
        ...new Set(
            service_ids
                .map(Number)
                .filter(
                    (id) =>
                        Number.isInteger(id) &&
                        id > 0
                )
        ),
    ];

    if (serviceIds.length === 0) {
        return res.status(400).json({
            message: "Serviços inválidos.",
        });
    }

    // -----------------------------------------------------
    // Busca os serviços
    // -----------------------------------------------------

    const placeholders = serviceIds
        .map(() => "?")
        .join(",");

    const [services] = await pool.query(
        `
        SELECT
            id,
            name,
            duration,
            price
        FROM services
        WHERE id IN (${placeholders})
        AND active = TRUE
        `,
        serviceIds
    );

    if (services.length !== serviceIds.length) {
        return res.status(400).json({
            message:
                "Um ou mais serviços selecionados não estão disponíveis.",
        });
    }

    // -----------------------------------------------------
    // Calcula duração e preço total
    // -----------------------------------------------------

    const totalDuration = services.reduce(
        (total, service) =>
            total + Number(service.duration),
        0
    );

    const totalPrice = services.reduce(
        (total, service) =>
            total + Number(service.price),
        0
    );

    // -----------------------------------------------------
    // Calcula horário final
    // -----------------------------------------------------

    const [startHour, startMinute] =
        start_time.split(":").map(Number);

    const startMinutes =
        startHour * 60 + startMinute;

    const endMinutes =
        startMinutes + totalDuration;

    const endHour =
        Math.floor(endMinutes / 60);

    const endMinute =
        endMinutes % 60;

    const endTime =
        `${String(endHour).padStart(2, "0")}:` +
        `${String(endMinute).padStart(2, "0")}:00`;

    // -----------------------------------------------------
    // Descobre o dia da semana
    // -----------------------------------------------------

    const dayOfWeek =
        new Date(
            `${appointment_date}T12:00:00`
        ).getDay();

    // -----------------------------------------------------
    // Busca horário de funcionamento
    //
    // business_hours usa:
    // opening_time
    // closing_time
    // -----------------------------------------------------

    const [businessHours] =
        await pool.query(
            `
            SELECT
                opening_time,
                closing_time
            FROM business_hours
            WHERE day_of_week = ?
            AND active = TRUE
            ORDER BY opening_time
            `,
            [dayOfWeek]
        );

    if (businessHours.length === 0) {
        return res.status(400).json({
            message:
                "A clínica não funciona neste dia.",
        });
    }

    // -----------------------------------------------------
    // Verifica se o horário comporta todos os serviços
    // -----------------------------------------------------

    const fitsBusinessHours =
        businessHours.some((period) => {
            const [periodStartHour, periodStartMinute] =
                period.opening_time
                    .toString()
                    .split(":")
                    .map(Number);

            const [periodEndHour, periodEndMinute] =
                period.closing_time
                    .toString()
                    .split(":")
                    .map(Number);

            const periodStart =
                periodStartHour * 60 +
                periodStartMinute;

            const periodEnd =
                periodEndHour * 60 +
                periodEndMinute;

            return (
                startMinutes >= periodStart &&
                endMinutes <= periodEnd
            );
        });

    if (!fitsBusinessHours) {
        return res.status(400).json({
            message:
                "O horário escolhido não comporta todos os serviços.",
        });
    }

    // -----------------------------------------------------
    // Verifica conflitos
    //
    // appointments usa:
    // start_time
    // end_time
    // -----------------------------------------------------

    const [conflicts] =
        await pool.query(
            `
            SELECT id
            FROM appointments
            WHERE appointment_date = ?
            AND status != 'cancelled'
            AND start_time < ?
            AND end_time > ?
            `,
            [
                appointment_date,
                endTime,
                start_time,
            ]
        );

    if (conflicts.length > 0) {
        return res.status(400).json({
            message:
                "Esse horário não está mais disponível.",
        });
    }

    // -----------------------------------------------------
    // Transação
    // -----------------------------------------------------

    const connection =
        await pool.getConnection();

    try {
        await connection.beginTransaction();

        /*
         * Mantemos o primeiro serviço em service_id
         * porque essa coluna ainda existe em appointments.
         *
         * Todos os serviços também são registrados
         * em appointment_services.
         */

        const firstServiceId =
            serviceIds[0];

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
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
                `,
                [
                    firstServiceId,
                    customer_name,
                    customer_phone,
                    appointment_date,
                    start_time,
                    endTime,
                ]
            );

        const appointmentId =
            appointmentResult.insertId;

        // -------------------------------------------------
        // Relaciona todos os serviços
        // -------------------------------------------------

        const serviceValues =
            serviceIds.map(
                (serviceId) => [
                    appointmentId,
                    serviceId,
                ]
            );

        await connection.query(
            `
            INSERT INTO appointment_services (
                appointment_id,
                service_id
            )
            VALUES ?
            `,
            [serviceValues]
        );

        await connection.commit();

        return res.status(201).json({
            message:
                "Agendamento realizado com sucesso.",

            appointment: {
                id: appointmentId,

                services: services.map(
                    (service) =>
                        service.name
                ),

                total_duration:
                    totalDuration,

                total_price:
                    totalPrice,

                appointment_date,

                start_time,

                end_time: endTime,

                customer_name,

                customer_phone,
            },
        });
    } catch (error) {
        await connection.rollback();

        console.error(
            "Erro ao criar agendamento:",
            error
        );

        return res.status(500).json({
            message:
                "Erro ao criar agendamento.",
        });
    } finally {
        connection.release();
    }
}


/* =========================================================
   HORÁRIOS DISPONÍVEIS
========================================================= */

export async function getAvailableTimes(req, res) {
    const {
        date,
        service_ids,
        service_id,
    } = req.query;

    // -----------------------------------------------------
    // Aceita service_ids no formato novo
    // e service_id no formato antigo
    // -----------------------------------------------------

    let rawServiceIds;

    if (service_ids) {
        rawServiceIds =
            Array.isArray(service_ids)
                ? service_ids
                : [service_ids];
    } else if (service_id) {
        rawServiceIds = [service_id];
    } else {
        rawServiceIds = [];
    }

    const serviceIds = [
        ...new Set(
            rawServiceIds
                .map(Number)
                .filter(
                    (id) =>
                        Number.isInteger(id) &&
                        id > 0
                )
        ),
    ];

    // -----------------------------------------------------
    // Valida data
    // -----------------------------------------------------

    if (!date) {
        return res.status(400).json({
            message: "Data não informada.",
        });
    }

    // -----------------------------------------------------
    // Valida serviços
    // -----------------------------------------------------

    if (serviceIds.length === 0) {
        return res.status(400).json({
            message:
                "Selecione pelo menos um serviço.",
        });
    }

    // -----------------------------------------------------
    // Busca serviços
    // -----------------------------------------------------

    const placeholders = serviceIds
        .map(() => "?")
        .join(",");

    const [services] =
        await pool.query(
            `
            SELECT
                id,
                duration
            FROM services
            WHERE id IN (${placeholders})
            AND active = TRUE
            `,
            serviceIds
        );

    if (
        services.length !==
        serviceIds.length
    ) {
        return res.status(400).json({
            message:
                "Um ou mais serviços não estão disponíveis.",
        });
    }

    // -----------------------------------------------------
    // Soma duração dos serviços
    // -----------------------------------------------------

    const totalDuration =
        services.reduce(
            (total, service) =>
                total +
                Number(service.duration),
            0
        );

    // -----------------------------------------------------
    // Dia da semana
    // -----------------------------------------------------

    const dayOfWeek =
        new Date(
            `${date}T12:00:00`
        ).getDay();

    // -----------------------------------------------------
    // Horário de funcionamento
    //
    // business_hours:
    // opening_time
    // closing_time
    // -----------------------------------------------------

    const [businessHours] =
        await pool.query(
            `
            SELECT
                opening_time,
                closing_time
            FROM business_hours
            WHERE day_of_week = ?
            AND active = TRUE
            ORDER BY opening_time
            `,
            [dayOfWeek]
        );

    if (businessHours.length === 0) {
        return res.json([]);
    }

    // -----------------------------------------------------
    // Agendamentos existentes
    //
    // appointments:
    // start_time
    // end_time
    // -----------------------------------------------------

    const [appointments] =
        await pool.query(
            `
            SELECT
                start_time,
                end_time
            FROM appointments
            WHERE appointment_date = ?
            AND status != 'cancelled'
            `,
            [date]
        );

    // -----------------------------------------------------
    // Gera horários
    // -----------------------------------------------------

    const availableTimes = [];

    const SLOT_INTERVAL = 30;

    for (const period of businessHours) {
        const [startHour, startMinute] =
            period.opening_time
                .toString()
                .split(":")
                .map(Number);

        const [endHour, endMinute] =
            period.closing_time
                .toString()
                .split(":")
                .map(Number);

        const periodStart =
            startHour * 60 +
            startMinute;

        const periodEnd =
            endHour * 60 +
            endMinute;

        for (
            let start = periodStart;
            start + totalDuration <=
                periodEnd;
            start += SLOT_INTERVAL
        ) {
            const end =
                start + totalDuration;

            const startTime =
                `${String(
                    Math.floor(start / 60)
                ).padStart(2, "0")}:` +
                `${String(
                    start % 60
                ).padStart(2, "0")}:00`;

            const endTime =
                `${String(
                    Math.floor(end / 60)
                ).padStart(2, "0")}:` +
                `${String(
                    end % 60
                ).padStart(2, "0")}:00`;

            // ---------------------------------------------
            // Verifica conflito
            // ---------------------------------------------

            const hasConflict =
                appointments.some(
                    (appointment) => {
                        const appointmentStart =
                            appointment.start_time
                                .toString()
                                .split(":")
                                .map(Number);

                        const appointmentEnd =
                            appointment.end_time
                                .toString()
                                .split(":")
                                .map(Number);

                        const existingStart =
                            appointmentStart[0] *
                                60 +
                            appointmentStart[1];

                        const existingEnd =
                            appointmentEnd[0] *
                                60 +
                            appointmentEnd[1];

                        return (
                            start <
                                existingEnd &&
                            end >
                                existingStart
                        );
                    }
                );

            if (!hasConflict) {
                availableTimes.push(
                    startTime.slice(0, 5)
                );
            }
        }
    }

    // -----------------------------------------------------
    // Remove duplicados
    // -----------------------------------------------------

    const uniqueTimes = [
        ...new Set(availableTimes),
    ];

    return res.json(uniqueTimes);
}


/* =========================================================
   LISTAR AGENDAMENTOS
========================================================= */

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
                        SUM(s2.duration),
                        s1.duration
                    ) AS duration,

                    COALESCE(
                        SUM(s2.price),
                        s1.price
                    ) AS price

                FROM appointments a

                LEFT JOIN appointment_services aps
                    ON a.id = aps.appointment_id

                LEFT JOIN services s2
                    ON aps.service_id = s2.id

                LEFT JOIN services s1
                    ON a.service_id = s1.id

                GROUP BY
                    a.id,
                    a.customer_name,
                    a.customer_phone,
                    a.appointment_date,
                    a.start_time,
                    a.end_time,
                    a.status,
                    s1.name,
                    s1.duration,
                    s1.price

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
                "Erro ao buscar agendamentos.",
        });
    }
}


/* =========================================================
   BUSCAR AGENDAMENTO POR ID
========================================================= */

export async function getAppointmentById(req, res) {
    const { id } = req.params;

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
                        SUM(s2.duration),
                        s1.duration
                    ) AS duration,

                    COALESCE(
                        SUM(s2.price),
                        s1.price
                    ) AS price

                FROM appointments a

                LEFT JOIN appointment_services aps
                    ON a.id = aps.appointment_id

                LEFT JOIN services s2
                    ON aps.service_id = s2.id

                LEFT JOIN services s1
                    ON a.service_id = s1.id

                WHERE a.id = ?

                GROUP BY
                    a.id,
                    a.customer_name,
                    a.customer_phone,
                    a.appointment_date,
                    a.start_time,
                    a.end_time,
                    a.status,
                    s1.name,
                    s1.duration,
                    s1.price
                `,
                [id]
            );

        if (appointments.length === 0) {
            return res.status(404).json({
                message:
                    "Agendamento não encontrado.",
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
                "Erro ao buscar agendamento.",
        });
    }
}


/* =========================================================
   ATUALIZAR STATUS
========================================================= */

export async function updateAppointmentStatus(
    req,
    res
) {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
    ];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            message: "Status inválido.",
        });
    }

    try {
        const [result] =
            await pool.query(
                `
                UPDATE appointments
                SET status = ?
                WHERE id = ?
                `,
                [status, id]
            );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message:
                    "Agendamento não encontrado.",
            });
        }

        return res.json({
            message:
                "Status atualizado com sucesso.",
        });
    } catch (error) {
        console.error(
            "Erro ao atualizar status:",
            error
        );

        return res.status(500).json({
            message:
                "Erro ao atualizar status.",
        });
    }
}


/* =========================================================
   DELETAR AGENDAMENTO
========================================================= */

export async function deleteAppointment(req, res) {
    const { id } = req.params;

    try {
        const [result] =
            await pool.query(
                `
                DELETE FROM appointments
                WHERE id = ?
                `,
                [id]
            );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message:
                    "Agendamento não encontrado.",
            });
        }

        return res.json({
            message:
                "Agendamento excluído com sucesso.",
        });
    } catch (error) {
        console.error(
            "Erro ao excluir agendamento:",
            error
        );

        return res.status(500).json({
            message:
                "Erro ao excluir agendamento.",
        });
    }
}