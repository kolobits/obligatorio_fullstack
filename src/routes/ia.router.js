// const express = require("express");
// const iaRouter = express.Router();

// const { useGeminiFlash } = require("../controllers/ia.controller");

// iaRouter.post("/gemini", useGeminiFlash);

// module.exports = iaRouter;


const express = require("express");
const iaRouter = express.Router();

const { useGroq } = require("../controllers/ia.controller");

iaRouter.post("/groq", useGroq);

module.exports = iaRouter;