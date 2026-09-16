import express from "express";

import {
    getPromotions,
    getPromotionById,
    createPromotion,
    updatePromotion,
    deletePromotion
} from "../controllers/promotionController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getPromotions);

router.get("/:id", getPromotionById);

router.post(
    "/",
    authMiddleware,
    createPromotion
);

router.put(
    "/:id",
    authMiddleware,
    updatePromotion
);

router.delete(
    "/:id",
    authMiddleware,
    deletePromotion
);

export default router;