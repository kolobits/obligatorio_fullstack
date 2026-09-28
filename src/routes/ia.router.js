const express = require("express");
const iaRouter = express.Router();

const { useGroq } = require("../controllers/ia.controller");

iaRouter.post("/groq", useGroq);

module.exports = iaRouter;