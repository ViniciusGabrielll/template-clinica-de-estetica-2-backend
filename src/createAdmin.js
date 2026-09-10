import bcrypt from "bcryptjs";
import pool from "./config/database.js";

const name = "Administrador";
const email = "admin@clinica.com";
const password = "123456";

const hashedPassword = await bcrypt.hash(password, 10);

await pool.query(
    `INSERT INTO admins
    (name, email, password)
    VALUES (?, ?, ?)`,
    [
        name,
        email,
        hashedPassword
    ]
);

console.log("Administrador criado!");

await pool.end();