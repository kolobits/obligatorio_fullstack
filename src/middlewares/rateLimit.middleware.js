const rateLimit = require("express-rate-limit");


const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Prueba de nuevo en un rato" }
});

const iaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas consultas a la IA. Prueba de nuevo en un rato" }
});

module.exports = {
    generalLimiter,
    iaLimiter
};
