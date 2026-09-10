import pool from "../config/database.js";


// =========================
// LISTAR HORÁRIOS
// =========================

export async function getBusinessHours(req, res) {
    try {
        const [businessHours] = await pool.query(
            `SELECT *
             FROM business_hours
             WHERE active = TRUE
             ORDER BY day_of_week ASC, opening_time ASC`
        );

        res.json(businessHours);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao buscar horários de funcionamento."
        });
    }
}


// =========================
// CRIAR HORÁRIO
// =========================

export async function createBusinessHour(req, res) {
    try {
        const {
            day_of_week,
            opening_time,
            closing_time
        } = req.body;

        if (
            day_of_week === undefined ||
            !opening_time ||
            !closing_time
        ) {
            return res.status(400).json({
                message:
                    "Dia, horário de abertura e horário de fechamento são obrigatórios."
            });
        }

        if (day_of_week < 0 || day_of_week > 6) {
            return res.status(400).json({
                message:
                    "O dia da semana deve estar entre 0 e 6."
            });
        }

        if (opening_time >= closing_time) {
            return res.status(400).json({
                message:
                    "O horário de abertura deve ser anterior ao horário de fechamento."
            });
        }

        const [result] = await pool.query(
            `INSERT INTO business_hours
            (
                day_of_week,
                opening_time,
                closing_time
            )
            VALUES (?, ?, ?)`,
            [
                day_of_week,
                opening_time,
                closing_time
            ]
        );

        res.status(201).json({
            message:
                "Horário de funcionamento criado com sucesso.",
            businessHourId: result.insertId
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message:
                "Erro ao criar horário de funcionamento."
        });
    }
}


// =========================
// ATUALIZAR HORÁRIO
// =========================

export async function updateBusinessHour(req, res) {
    try {
        const { id } = req.params;

        const {
            day_of_week,
            opening_time,
            closing_time
        } = req.body;

        if (
            day_of_week === undefined ||
            !opening_time ||
            !closing_time
        ) {
            return res.status(400).json({
                message:
                    "Dia, horário de abertura e horário de fechamento são obrigatórios."
            });
        }

        if (day_of_week < 0 || day_of_week > 6) {
            return res.status(400).json({
                message:
                    "O dia da semana deve estar entre 0 e 6."
            });
        }

        if (opening_time >= closing_time) {
            return res.status(400).json({
                message:
                    "O horário de abertura deve ser anterior ao horário de fechamento."
            });
        }

        const [result] = await pool.query(
            `UPDATE business_hours
             SET
                day_of_week = ?,
                opening_time = ?,
                closing_time = ?
             WHERE id = ?
             AND active = TRUE`,
            [
                day_of_week,
                opening_time,
                closing_time,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message:
                    "Horário de funcionamento não encontrado."
            });
        }

        res.json({
            message:
                "Horário de funcionamento atualizado com sucesso."
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message:
                "Erro ao atualizar horário de funcionamento."
        });
    }
}


// =========================
// EXCLUIR HORÁRIO
// =========================

export async function deleteBusinessHour(req, res) {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `UPDATE business_hours
             SET active = FALSE
             WHERE id = ?
             AND active = TRUE`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message:
                    "Horário de funcionamento não encontrado."
            });
        }

        res.json({
            message:
                "Horário de funcionamento excluído com sucesso."
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message:
                "Erro ao excluir horário de funcionamento."
        });
    }
}