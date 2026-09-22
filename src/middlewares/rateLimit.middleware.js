const rateLimit = require("express-rate-limit");

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Prueba de nuevo en un rato"}
})

module.exports = {
    generalLimiter
}