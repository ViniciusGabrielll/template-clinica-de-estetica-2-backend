import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

export async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email e senha são obrigatórios."
            });
        }

        const [admins] = await pool.query(
            `SELECT *
             FROM admins
             WHERE email = ?`,
            [email]
        );

        if (admins.length === 0) {
            return res.status(401).json({
                message: "Email ou senha inválidos."
            });
        }

        const admin = admins[0];

        const passwordIsValid = await bcrypt.compare(
            password,
            admin.password
        );

        if (!passwordIsValid) {
            return res.status(401).json({
                message: "Email ou senha inválidos."
            });
        }

        const token = jwt.sign(
            {
                id: admin.id,
                email: admin.email,
                name: admin.name
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        res.json({
            message: "Login realizado com sucesso.",
            token,
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao realizar login."
        });
    }
}

export async function getMe(req, res) {
    try {
        const [admins] = await pool.query(
            `SELECT id, name, email, created_at
             FROM admins
             WHERE id = ?`,
            [req.admin.id]
        );

        if (admins.length === 0) {
            return res.status(404).json({
                message: "Administrador não encontrado."
            });
        }

        res.json({
            admin: admins[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao buscar administrador."
        });
    }
}