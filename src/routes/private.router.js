const express = require("express");
const router = express.Router();

const {
    getViajesController,
    getViajeController,
    postViajeController,
    deleteViajeController,
    putViajeController
} = require("../controllers/viajes.controller");
const payloadMiddleware = require("../middlewares/payload.middleware");
const { viajeValidation, viajeUpdateValidation } = require("./validations/viaje.validation");

router.get("/viajes", getViajesController);
router.get("/viajes/:id", getViajeController);
router.post("/viajes", payloadMiddleware(viajeValidation), postViajeController);
router.put("/viajes/:id", payloadMiddleware(viajeUpdateValidation), putViajeController);
router.delete("/viajes/:id", deleteViajeController);

module.exports = router;