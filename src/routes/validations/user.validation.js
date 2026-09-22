const Joi = require("joi");

const signupValidation = Joi.object({
  name: Joi.string().min(3).max(20).required(),
  username: Joi.string().min(3).max(20).required(),
  email: Joi.string().min(3).max(40).required(),
  password: Joi.string().min(3).max(20).alphanum().required(),
});

const loginValidation = Joi.object({
  username: Joi.string().min(3).max(20).required(),
  password: Joi.string().min(3).max(20).alphanum().required(),
});

module.exports = {
    signupValidation,
    loginValidation
};
