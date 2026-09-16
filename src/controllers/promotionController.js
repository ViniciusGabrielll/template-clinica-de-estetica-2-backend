import pool from "../config/database.js";

export async function getPromotions(req, res) {
    try {
        await pool.query(
            `DELETE FROM promotions
             WHERE expires_at <= NOW()`
        );

        const [promotions] = await pool.query(
            `SELECT
                promotions.*,
                services.name AS service_name,
                services.image_url AS service_image
             FROM promotions
             INNER JOIN services
                ON promotions.service_id = services.id
             WHERE services.active = TRUE
             AND promotions.expires_at > NOW()
             ORDER BY promotions.expires_at ASC`
        );

        res.json(promotions);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao buscar promoções."
        });
    }
}

export async function getPromotionById(req, res) {
    try {
        const { id } = req.params;

        await pool.query(
            `DELETE FROM promotions
             WHERE expires_at <= NOW()`
        );

        const [promotions] = await pool.query(
            `SELECT
                promotions.*,
                services.name AS service_name,
                services.image_url AS service_image
             FROM promotions
             INNER JOIN services
                ON promotions.service_id = services.id
             WHERE promotions.id = ?
             AND services.active = TRUE
             AND promotions.expires_at > NOW()`,
            [id]
        );

        if (promotions.length === 0) {
            return res.status(404).json({
                message: "Promoção não encontrada."
            });
        }

        res.json(promotions[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao buscar promoção."
        });
    }
}

export async function createPromotion(req, res) {
    try {
        const {
            service_id,
            promotional_price,
            expires_at
        } = req.body;

        if (
            !service_id ||
            promotional_price === undefined ||
            !expires_at
        ) {
            return res.status(400).json({
                message: "Serviço, preço promocional e data de término são obrigatórios."
            });
        }

        const [services] = await pool.query(
            `SELECT id, price
             FROM services
             WHERE id = ?
             AND active = TRUE`,
            [service_id]
        );

        if (services.length === 0) {
            return res.status(404).json({
                message: "Serviço não encontrado."
            });
        }

        const originalPrice = Number(services[0].price);
        const promotionalPrice = Number(promotional_price);

        if (Number.isNaN(promotionalPrice)) {
            return res.status(400).json({
                message: "Informe um preço promocional válido."
            });
        }

        if (promotionalPrice < 0) {
            return res.status(400).json({
                message: "O preço promocional não pode ser negativo."
            });
        }

        if (promotionalPrice >= originalPrice) {
            return res.status(400).json({
                message: "O preço promocional deve ser menor que o preço original."
            });
        }

        const expirationDate = new Date(expires_at);

        if (Number.isNaN(expirationDate.getTime())) {
            return res.status(400).json({
                message: "Informe uma data de término válida."
            });
        }

        if (expirationDate <= new Date()) {
            return res.status(400).json({
                message: "A promoção deve terminar no futuro."
            });
        }

        const [existingPromotion] = await pool.query(
            `SELECT id
             FROM promotions
             WHERE service_id = ?
             AND expires_at > NOW()`,
            [service_id]
        );

        if (existingPromotion.length > 0) {
            return res.status(409).json({
                message: "Este serviço já possui uma promoção ativa."
            });
        }

        const [result] = await pool.query(
            `INSERT INTO promotions
            (
                service_id,
                original_price,
                promotional_price,
                expires_at
            )
            VALUES (?, ?, ?, ?)`,
            [
                service_id,
                originalPrice,
                promotionalPrice,
                expirationDate
            ]
        );

        res.status(201).json({
            message: "Promoção criada com sucesso.",
            promotionId: result.insertId
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao criar promoção."
        });
    }
}

export async function updatePromotion(req, res) {
    try {
        const { id } = req.params;

        const {
            service_id,
            promotional_price,
            expires_at
        } = req.body;

        if (
            !service_id ||
            promotional_price === undefined ||
            !expires_at
        ) {
            return res.status(400).json({
                message: "Serviço, preço promocional e data de término são obrigatórios."
            });
        }

        const [services] = await pool.query(
            `SELECT id, price
             FROM services
             WHERE id = ?
             AND active = TRUE`,
            [service_id]
        );

        if (services.length === 0) {
            return res.status(404).json({
                message: "Serviço não encontrado."
            });
        }

        const originalPrice = Number(services[0].price);
        const promotionalPrice = Number(promotional_price);

        if (Number.isNaN(promotionalPrice)) {
            return res.status(400).json({
                message: "Informe um preço promocional válido."
            });
        }

        if (promotionalPrice < 0) {
            return res.status(400).json({
                message: "O preço promocional não pode ser negativo."
            });
        }

        if (promotionalPrice >= originalPrice) {
            return res.status(400).json({
                message: "O preço promocional deve ser menor que o preço original."
            });
        }

        const expirationDate = new Date(expires_at);

        if (Number.isNaN(expirationDate.getTime())) {
            return res.status(400).json({
                message: "Informe uma data de término válida."
            });
        }

        if (expirationDate <= new Date()) {
            return res.status(400).json({
                message: "A promoção deve terminar no futuro."
            });
        }

        const [existingPromotion] = await pool.query(
            `SELECT id
             FROM promotions
             WHERE service_id = ?
             AND id != ?
             AND expires_at > NOW()`,
            [service_id, id]
        );

        if (existingPromotion.length > 0) {
            return res.status(409).json({
                message: "Este serviço já possui outra promoção ativa."
            });
        }

        const [result] = await pool.query(
            `UPDATE promotions
             SET
                service_id = ?,
                original_price = ?,
                promotional_price = ?,
                expires_at = ?
             WHERE id = ?`,
            [
                service_id,
                originalPrice,
                promotionalPrice,
                expirationDate,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Promoção não encontrada."
            });
        }

        res.json({
            message: "Promoção atualizada com sucesso."
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao atualizar promoção."
        });
    }
}

export async function deletePromotion(req, res) {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `DELETE FROM promotions
             WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Promoção não encontrada."
            });
        }

        res.json({
            message: "Promoção excluída com sucesso."
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao excluir promoção."
        });
    }
}