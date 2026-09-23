const express = require("express");
const router = express.Router();
const { postAuthSignup, postAuthLogin } = require("../controllers/auth.controller");
const payloadMiddleware = require("../middlewares/payload.middleware");
const { signupValidation, loginValidation } = require("./validations/user.validation");

router.post("/signup", payloadMiddleware(signupValidation), postAuthSignup);
router.post("/login", payloadMiddleware(loginValidation), postAuthLogin);

module.exports = router;