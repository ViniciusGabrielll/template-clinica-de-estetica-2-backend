import express from "express";

import {
    getServices,
    getServiceById,
    createService,
    updateService,
    deleteService
} from "../controllers/serviceController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getServices);

router.get("/:id", getServiceById);


router.post(
    "/",
    authMiddleware,
    createService
);

router.put(
    "/:id",
    authMiddleware,
    updateService
);

router.delete(
    "/:id",
    authMiddleware,
    deleteService
);


export default router;