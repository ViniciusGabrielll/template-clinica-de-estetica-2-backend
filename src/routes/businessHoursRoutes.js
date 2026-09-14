import express from "express";

import {
    getBusinessHours,
    createBusinessHour,
    updateBusinessHour,
    deleteBusinessHour
} from "../controllers/businessHoursController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();


router.get(
    "/",
    getBusinessHours
);


// =========================
// ADMIN
// =========================

router.post(
    "/",
    authMiddleware,
    createBusinessHour
);

router.put(
    "/:id",
    authMiddleware,
    updateBusinessHour
);

router.delete(
    "/:id",
    authMiddleware,
    deleteBusinessHour
);


export default router;