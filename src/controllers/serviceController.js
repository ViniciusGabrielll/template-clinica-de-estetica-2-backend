import pool from "../config/database.js";
import cloudinary from "../config/cloudinary.js";
import sharp from "sharp";

async function uploadImageToCloudinary(file) {
    if (!file) {
        return null;
    }

    console.log("Arquivo recebido:", {
        name: file.originalname,
        mimetype: file.mimetype,
        size: file.size
    });

    try {
        const result = await cloudinary.uploader.upload(
            `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
            {
                folder: "clinica-estetica/services",
                resource_type: "image"
            }
        );

        console.log("Upload concluído:", result.secure_url);

        return result.secure_url;
    } catch (error) {
        console.error("Erro no upload:", error);
        throw error;
    }
}

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

        if (Number(duration) <= 0) {
            return res.status(400).json({
                message: "A duração deve ser maior que zero."
            });
        }

        if (Number(price) < 0) {
            return res.status(400).json({
                message: "O preço não pode ser negativo."
            });
        }

        const imageUrl = await uploadImageToCloudinary(req.file);

        const [result] = await pool.query(
            `INSERT INTO services
            (name, description, duration, price, image_url)
            VALUES (?, ?, ?, ?, ?)`,
            [
                name,
                description || null,
                Number(duration),
                Number(price),
                imageUrl
            ]
        );

        res.status(201).json({
            message: "Serviço criado com sucesso.",
            serviceId: result.insertId,
            image_url: imageUrl
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao criar serviço."
        });
    }
}

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

        if (Number(duration) <= 0) {
            return res.status(400).json({
                message: "A duração deve ser maior que zero."
            });
        }

        if (Number(price) < 0) {
            return res.status(400).json({
                message: "O preço não pode ser negativo."
            });
        }

        let query;
        let values;

        if (req.file) {
            const imageUrl = await uploadImageToCloudinary(req.file);

            query = `
                UPDATE services
                SET
                    name = ?,
                    description = ?,
                    duration = ?,
                    price = ?,
                    image_url = ?
                WHERE id = ?
                AND active = TRUE
            `;

            values = [
                name,
                description || null,
                Number(duration),
                Number(price),
                imageUrl,
                id
            ];
        } else {
            query = `
                UPDATE services
                SET
                    name = ?,
                    description = ?,
                    duration = ?,
                    price = ?
                WHERE id = ?
                AND active = TRUE
            `;

            values = [
                name,
                description || null,
                Number(duration),
                Number(price),
                id
            ];
        }

        const [result] = await pool.query(query, values);

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