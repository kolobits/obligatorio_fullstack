const Joi = require("joi");

const viajeValidation = Joi.object({
    destino: Joi.string().min(2).max(50).required(),
    fechaInicio: Joi.date().required(),
    fechaFin: Joi.date().required(),
    presupuesto: Joi.number().positive().required(),
    descripcion: Joi.string().max(200),
    categoria: Joi.string().max(30),
});

const viajeUpdateValidation = viajeValidation.fork(
    ["destino", "fechaInicio", "fechaFin", "presupuesto"],
    (schema) => schema.optional()
);

module.exports = { viajeValidation, viajeUpdateValidation };