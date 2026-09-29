const Joi = require("joi");

const categoriaValidation = Joi.object({
    nombre: Joi.string().min(2).max(30).required(),
    descripcion: Joi.string().max(150).allow("")
});

const categoriaUpdateValidation = Joi.object({
    nombre: Joi.string().min(2).max(30),
    descripcion: Joi.string().max(150).allow("")
});

module.exports = { categoriaValidation, categoriaUpdateValidation };