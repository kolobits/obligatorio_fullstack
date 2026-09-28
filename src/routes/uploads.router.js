const express = require("express");
const uploadsRouter = express.Router();

const { upload } = require("../middlewares/multer.middleware");
const xssMiddleware = require("../middlewares/xss.middleware");
const { subirImagen }  = require("../controllers/uploads.controller");

// El body de un form-data recién existe después de Multer, por eso sanitizamos acá también
uploadsRouter.post("/", upload.single("imagen"), xssMiddleware, subirImagen);

module.exports = uploadsRouter;
