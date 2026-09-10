import express from "express";

import {
    getBlockedDates,
    createBlockedDate,
    deleteBlockedDate
} from "../controllers/blockedDateController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();


// =========================
// PÚBLICO
// =========================

router.get(
    "/",
    getBlockedDates
);


// =========================
// ADMIN
// =========================

router.post(
    "/",
    authMiddleware,
    createBlockedDate
);

router.delete(
    "/:id",
    authMiddleware,
    deleteBlockedDate
);


export default router;