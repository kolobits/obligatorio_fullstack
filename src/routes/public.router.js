const express = require("express");
const router = express.Router();

const { healthController, pingController } = require("../controllers/public.controller");

router.get("/health", healthController);
router.get("/ping", pingController);

module.exports = router;