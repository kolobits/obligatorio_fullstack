const express = require("express");
const uploadsRouter = express.Router();

const { upload } = require("../middlewares/multer.middleware");
const xssMiddleware = require("../middlewares/xss.middleware");
const { subirImagen }  = require("../controllers/uploads.controller");


uploadsRouter.post("/", upload.single("imagen"), xssMiddleware, subirImagen);

module.exports = uploadsRouter;
