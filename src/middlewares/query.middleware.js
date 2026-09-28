// Igual que payloadMiddleware, pero valida los query params (?page=1&estado=...)
const queryMiddleware = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query);

    if (error) {
      return res.status(400).json({
        error: "Validation error",
        details: error.details.map((err) => err.message),
      });
    }
    next();
  };
};

module.exports = queryMiddleware;
