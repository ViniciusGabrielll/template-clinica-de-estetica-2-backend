import express from "express";

import {
    createAppointment,
    getAvailableTimes,
    getAppointments,
    getAppointmentById,
    updateAppointmentStatus,
    deleteAppointment
} from "../controllers/appointmentController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", createAppointment);

router.get(
    "/available",
    getAvailableTimes
);

router.get(
    "/",
    authMiddleware,
    getAppointments
);

router.get(
    "/:id",
    authMiddleware,
    getAppointmentById
);

router.patch(
    "/:id/status",
    authMiddleware,
    updateAppointmentStatus
);

router.delete(
    "/:id",
    authMiddleware,
    deleteAppointment
);

export default router;