const rateLimit = require("express-rate-limit");

// Límite general para toda la API: 100 pedidos cada 15 minutos por IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Prueba de nuevo en un rato" }
});

// Límite más estricto para los endpoints que llaman a la IA (cada llamada consume cuota)
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
