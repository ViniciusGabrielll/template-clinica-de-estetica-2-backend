import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import businessHoursRoutes from "./routes/businessHoursRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import blockedDateRoutes from "./routes/blockedDateRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/business-hours", businessHoursRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use(
    "/api/blocked-dates",
    blockedDateRoutes
);

app.get("/", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            message: "API funcionando!",
            database: "MySQL conectado!"
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Erro ao conectar com o banco de dados."
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});