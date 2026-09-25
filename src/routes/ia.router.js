const express = require("express");
const iaRouter = express.Router();

const { useGeminiFlash } = require("../controllers/ia.controller");

iaRouter.post("/gemini", useGeminiFlash);

module.exports = iaRouter;