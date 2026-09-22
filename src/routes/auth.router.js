const express = require("express");
const router = express.Router();
const { postAuthSignup, postAuthLogin } = require("../controllers/auth.controller");
const payloadMiddleware = require("../middlewares/payload.middleware");
const { signupSchema, loginSchema } = require("../models/schemas/user.schema");

router.post("/signup", payloadMiddleware(signupSchema), postAuthSignup);
router.post("/login", payloadMiddleware(loginSchema), postAuthLogin);

module.exports = router;