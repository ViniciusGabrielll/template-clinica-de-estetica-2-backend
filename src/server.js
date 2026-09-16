import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import businessHoursRoutes from "./routes/businessHoursRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import blockedDateRoutes from "./routes/blockedDateRoutes.js";
import {
    deleteExpiredAppointments
} from "./controllers/appointmentController.js";

import {
    deleteExpiredBlockedDates
} from "./controllers/blockedDateController.js";

import cloudinary from "./config/cloudinary.js";

import promotionRoutes from "./routes/promotionRoutes.js";

console.log("Cloudinary:", cloudinary.config().cloud_name);

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
app.use("/api/promotions", promotionRoutes);


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

setInterval(async () => {
    try {
        const deletedAppointments =
            await deleteExpiredAppointments();

        const deletedBlockedDates =
            await deleteExpiredBlockedDates();

        if (deletedAppointments > 0) {
            console.log(
                `${deletedAppointments} agendamento(s) expirado(s) excluído(s).`
            );
        }

        if (deletedBlockedDates > 0) {
            console.log(
                `${deletedBlockedDates} dia(s) bloqueado(s) expirado(s) excluído(s).`
            );
        }
    } catch (error) {
        console.error(
            "Erro na limpeza automática:",
            error
        );
    }
}, 5 * 60 * 1000);