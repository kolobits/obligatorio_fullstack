const xss = require("xss");

// Limpia un valor: si es texto le saca el código HTML/JS peligroso (ej: <script>),
// si es un objeto o un array limpia cada uno de sus valores
const limpiar = (valor) => {
  if (typeof valor === "string") {
    return xss(valor);
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => limpiar(item));
  }
  if (valor && typeof valor === "object") {
    const limpio = {};
    Object.entries(valor).forEach(([key, value]) => {
      limpio[key] = limpiar(value);
    });
    return limpio;
  }
  return valor;
};

// Sanitiza el body de todas las peticiones antes de que llegue a los controllers.
// Los query params y el :id se validan con Joi (solo aceptan valores permitidos).
const xssMiddleware = (req, res, next) => {
  if (req.body) {
    req.body = limpiar(req.body);
  }
  next();
};

module.exports = xssMiddleware;
