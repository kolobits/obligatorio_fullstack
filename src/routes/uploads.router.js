const express = require("express");
const uploadsRouter = express.Router();

const { upload } = require("../middlewares/multer.middleware");
const { subirImagen }  = require("../controllers/uploads.controller");

uploadsRouter.post("/", upload.single("imagen"), subirImagen);

module.exports = uploadsRouter;