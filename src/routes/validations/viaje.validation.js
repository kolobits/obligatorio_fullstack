const Joi = require("joi");

const ESTADOS_VIAJE = ["planificado", "en_curso", "finalizado", "cancelado"];

const viajeValidation = Joi.object({
    destino: Joi.string().min(2).max(50).required(),
    fechaInicio: Joi.date().required(),
    fechaFin: Joi.date().min(Joi.ref("fechaInicio")).required(),
    presupuesto: Joi.number().positive().required(),
    descripcion: Joi.string().max(200).allow(""),
    categoria: Joi.string().max(30).allow(""),
    estado: Joi.string().valid(...ESTADOS_VIAJE),
    imagenUrl: Joi.string().uri().allow(""),
});

const viajeUpdateValidation = viajeValidation.fork(
    ["destino", "fechaInicio", "fechaFin", "presupuesto"],
    (schema) => schema.optional()
);

module.exports = { viajeValidation, viajeUpdateValidation, ESTADOS_VIAJE };