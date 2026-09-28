const Joi = require("joi");

const idSchema = Joi.string().hex().length(24).required();

const idMiddleware = (req, res, next) => {
  const { error } = idSchema.validate(req.params.id);

  if (error) {
    return res.status(400).json({ message: "El id no tiene un formato válido" });
  }
  next();
};

module.exports = idMiddleware;
