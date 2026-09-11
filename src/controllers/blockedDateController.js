import pool from "../config/database.js";

export async function getBlockedDates(req, res) {
    try {
        const [blockedDates] = await pool.query(
            `
            SELECT *
            FROM blocked_dates
            ORDER BY date ASC
            `
        );

        res.json(blockedDates);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao buscar dias bloqueados."
        });
    }
}

export async function createBlockedDate(req, res) {
    try {
        const {
            date,
            reason
        } = req.body;

        if (!date) {
            return res.status(400).json({
                message: "A data é obrigatória."
            });
        }

        const [existingDates] = await pool.query(
            `
            SELECT id
            FROM blocked_dates
            WHERE date = ?
            `,
            [date]
        );

        if (existingDates.length > 0) {
            return res.status(409).json({
                message: "Essa data já está bloqueada."
            });
        }

        const [result] = await pool.query(
            `
            INSERT INTO blocked_dates
            (
                date,
                reason
            )
            VALUES (?, ?)
            `,
            [
                date,
                reason || null
            ]
        );

        res.status(201).json({
            message: "Dia bloqueado com sucesso.",
            blockedDateId: result.insertId
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao bloquear dia."
        });
    }
}

export async function deleteBlockedDate(req, res) {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `
            DELETE FROM blocked_dates
            WHERE id = ?
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Dia bloqueado não encontrado."
            });
        }

        res.json({
            message: "Dia desbloqueado com sucesso."
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao desbloquear dia."
        });
    }
}

export async function deleteExpiredBlockedDates() {
    try {
        const [result] = await pool.query(
            `
            DELETE FROM blocked_dates
            WHERE date < CURDATE()
            `
        );

        return result.affectedRows;
    } catch (error) {
        console.error(
            "Erro ao excluir dias bloqueados expirados:",
            error
        );

        throw error;
    }
}