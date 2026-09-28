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
  getPuntosInteresViajeController,
} = require("../controllers/viajes.controller");
const {
  putPlanController,
  getPerfilController,
} = require("../controllers/usuarios.controller");
const {
  getCategoriasController,
  getCategoriaController,
  postCategoriaController,
  putCategoriaController,
  deleteCategoriaController,
} = require("../controllers/categorias.controller");
const payloadMiddleware = require("../middlewares/payload.middleware");
const queryMiddleware = require("../middlewares/query.middleware");
const idMiddleware = require("../middlewares/id.middleware");
const adminMiddleware = require("../middlewares/adminMiddleware");
const { iaLimiter } = require("../middlewares/rateLimit.middleware");
const {
  viajeValidation,
  viajeUpdateValidation,
  viajeQueryValidation,
} = require("./validations/viaje.validation");
const {
  categoriaValidation,
  categoriaUpdateValidation,
} = require("./validations/categoria.validation");

// Viajes
router.get("/viajes", queryMiddleware(viajeQueryValidation), getViajesController);
router.get("/viajes/:id", idMiddleware, getViajeController);
router.post("/viajes", payloadMiddleware(viajeValidation), postViajeController);
router.put(
  "/viajes/:id",
  idMiddleware,
  payloadMiddleware(viajeUpdateValidation),
  putViajeController,
);
router.delete("/viajes/:id", idMiddleware, deleteViajeController);

router.get("/viajes/:id/clima", idMiddleware, iaLimiter, getClimaViajeController);
router.get("/viajes/:id/distancia", idMiddleware, getDistanciaViajeController);
router.get("/viajes/:id/puntos-interes", idMiddleware, getPuntosInteresViajeController);

// Categorías
router.get("/categorias", getCategoriasController);
router.get("/categorias/:id", idMiddleware, getCategoriaController);
router.post(
  "/categorias",
  adminMiddleware,
  payloadMiddleware(categoriaValidation),
  postCategoriaController,
);
router.put(
  "/categorias/:id",
  idMiddleware,
  adminMiddleware,
  payloadMiddleware(categoriaUpdateValidation),
  putCategoriaController,
);
router.delete("/categorias/:id", idMiddleware, adminMiddleware, deleteCategoriaController);

// Usuarios
router.put("/usuarios/plan", putPlanController);
router.get("/usuarios/perfil", getPerfilController);

module.exports = router;
