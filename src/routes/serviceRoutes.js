import express from "express";

import {
    getServices,
    getFeaturedServices,
    getServiceById,
    createService,
    updateService,
    deleteService
} from "../controllers/serviceController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import upload from "../config/upload.js";

const router = express.Router();

router.get("/", getServices);

router.get("/featured", getFeaturedServices);

router.get("/:id", getServiceById);

router.post(
    "/",
    authMiddleware,
    upload.single("image"),
    createService
);

router.put(
    "/:id",
    authMiddleware,
    upload.single("image"),
    updateService
);

router.delete(
    "/:id",
    authMiddleware,
    deleteService
);

export default router;