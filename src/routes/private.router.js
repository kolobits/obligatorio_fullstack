const express = require("express");
const router = express.Router();

const {
    getViajesController,
    getViajeController,
    postViajeController,
    deleteViajeController,
    putViajeController,
    getClimaViajeController,
    getDistanciaViajeController,
    getPuntosInteresViajeController
} = require("../controllers/viajes.controller");
const {putPlanController} = require("../controllers/usuarios.controller");
const payloadMiddleware = require("../middlewares/payload.middleware");
const { viajeValidation, viajeUpdateValidation } = require("./validations/viaje.validation");
const adminMiddleware = require("../middlewares/adminMiddleware");
const {
    getCategoriasController,
    getCategoriaController,
    postCategoriaController,
    putCategoriaController,
    deleteCategoriaController
} = require("../controllers/categorias.controller");
const { categoriaValidation, categoriaUpdateValidation } = require("./validations/categoria.validation");

router.get("/viajes", getViajesController);
router.get("/viajes/:id", getViajeController);
router.post("/viajes", payloadMiddleware(viajeValidation), postViajeController);
router.put("/viajes/:id", payloadMiddleware(viajeUpdateValidation), putViajeController);
router.delete("/viajes/:id", deleteViajeController);

router.get("/viajes/:id/clima", getClimaViajeController);
router.get("/viajes/:id/distancia", getDistanciaViajeController);
router.get("/viajes/:id/puntos-interes", getPuntosInteresViajeController);

router.get("/categorias", getCategoriasController);
router.get("/categorias/:id", getCategoriaController);
router.post("/categorias", adminMiddleware, payloadMiddleware(categoriaValidation), postCategoriaController);
router.put("/categorias/:id", adminMiddleware, payloadMiddleware(categoriaUpdateValidation), putCategoriaController);
router.delete("/categorias/:id", adminMiddleware, deleteCategoriaController);

router.put("/usuarios/plan", putPlanController);

module.exports = router;
