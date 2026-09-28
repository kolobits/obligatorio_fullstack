const Joi = require("joi");

const ESTADOS_VIAJE = ["planificado", "en_curso", "finalizado", "cancelado"];

const viajeValidation = Joi.object({
    destino: Joi.string().min(2).max(50).required(),
    fechaInicio: Joi.date().required(),
    fechaFin: Joi.date().min(Joi.ref("fechaInicio")).required(),
    presupuesto: Joi.number().positive().required(),
    descripcion: Joi.string().max(200).allow(""),
    categoria: Joi.string().hex().length(24).allow(null),
    estado: Joi.string().valid(...ESTADOS_VIAJE),
    imagenUrl: Joi.string().uri().allow(""),
});

const viajeUpdateValidation = Joi.object({
    destino: Joi.string().min(2).max(50),
    fechaInicio: Joi.date(),
    fechaFin: Joi.date().min(Joi.ref("fechaInicio")),
    presupuesto: Joi.number().positive(),
    descripcion: Joi.string().max(200).allow(""),
    categoria: Joi.string().hex().length(24).allow(null),
    estado: Joi.string().valid(...ESTADOS_VIAJE),
    imagenUrl: Joi.string().uri().allow(""),
});

// Query params de GET /viajes: paginación y filtros
const viajeQueryValidation = Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(50),
    estado: Joi.string().valid(...ESTADOS_VIAJE),
    categoria: Joi.string().hex().length(24),
});

module.exports = {
    viajeValidation,
    viajeUpdateValidation,
    viajeQueryValidation,
    ESTADOS_VIAJE,
};
