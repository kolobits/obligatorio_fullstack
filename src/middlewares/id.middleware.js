const Joi = require("joi");

// Los ids de MongoDB son 24 caracteres hexadecimales
const idSchema = Joi.string().hex().length(24).required();

// Valida el :id de la URL antes de llegar al controller.
// Sin esto, un id mal formado hace fallar a Mongoose y la API devuelve 500.
const idMiddleware = (req, res, next) => {
  const { error } = idSchema.validate(req.params.id);

  if (error) {
    return res.status(400).json({ message: "El id no tiene un formato válido" });
  }
  next();
};

module.exports = idMiddleware;
