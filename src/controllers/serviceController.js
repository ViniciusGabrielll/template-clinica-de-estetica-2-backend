import pool from "../config/database.js";


// =========================
// LISTAR SERVIÇOS
// =========================

export async function getServices(req, res) {
    try {
        const [services] = await pool.query(
            `SELECT *
             FROM services
             WHERE active = TRUE
             ORDER BY id DESC`
        );

        res.json(services);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao buscar serviços."
        });
    }
}


// =========================
// BUSCAR SERVIÇO POR ID
// =========================

export async function getServiceById(req, res) {
    try {
        const { id } = req.params;

        const [services] = await pool.query(
            `SELECT *
             FROM services
             WHERE id = ?
             AND active = TRUE`,
            [id]
        );

        if (services.length === 0) {
            return res.status(404).json({
                message: "Serviço não encontrado."
            });
        }

        res.json(services[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao buscar serviço."
        });
    }
}


// =========================
// CRIAR SERVIÇO
// =========================

export async function createService(req, res) {
    try {
        const {
            name,
            description,
            duration,
            price
        } = req.body;

        if (!name || !duration || price === undefined) {
            return res.status(400).json({
                message: "Nome, duração e preço são obrigatórios."
            });
        }

        if (duration <= 0) {
            return res.status(400).json({
                message: "A duração deve ser maior que zero."
            });
        }

        if (price < 0) {
            return res.status(400).json({
                message: "O preço não pode ser negativo."
            });
        }

        const [result] = await pool.query(
            `INSERT INTO services
            (name, description, duration, price)
            VALUES (?, ?, ?, ?)`,
            [
                name,
                description || null,
                duration,
                price
            ]
        );

        res.status(201).json({
            message: "Serviço criado com sucesso.",
            serviceId: result.insertId
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao criar serviço."
        });
    }
}


// =========================
// ATUALIZAR SERVIÇO
// =========================

export async function updateService(req, res) {
    try {
        const { id } = req.params;

        const {
            name,
            description,
            duration,
            price
        } = req.body;

        if (!name || !duration || price === undefined) {
            return res.status(400).json({
                message: "Nome, duração e preço são obrigatórios."
            });
        }

        if (duration <= 0) {
            return res.status(400).json({
                message: "A duração deve ser maior que zero."
            });
        }

        if (price < 0) {
            return res.status(400).json({
                message: "O preço não pode ser negativo."
            });
        }

        const [result] = await pool.query(
            `UPDATE services
             SET
                name = ?,
                description = ?,
                duration = ?,
                price = ?
             WHERE id = ?
             AND active = TRUE`,
            [
                name,
                description || null,
                duration,
                price,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Serviço não encontrado."
            });
        }

        res.json({
            message: "Serviço atualizado com sucesso."
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao atualizar serviço."
        });
    }
}


// =========================
// EXCLUIR SERVIÇO
// =========================

export async function deleteService(req, res) {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `UPDATE services
             SET active = FALSE
             WHERE id = ?
             AND active = TRUE`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Serviço não encontrado."
            });
        }

        res.json({
            message: "Serviço excluído com sucesso."
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao excluir serviço."
        });
    }
}