const xss = require("xss");

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

const xssMiddleware = (req, res, next) => {
  if (req.body) {
    req.body = limpiar(req.body);
  }
  next();
};

module.exports = xssMiddleware;
