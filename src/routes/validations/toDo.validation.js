const Joi = require("joi");

const todoValidation = Joi.object({
  title: Joi.string().min(3).max(20).required(),
});

module.exports = todoValidation;
