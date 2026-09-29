const xss = require("xss");

const xssMiddleware = (req, res, next) => {
  Object.keys(req.body || {}).forEach((key) => {
    if (typeof req.body[key] === "string" && key !== "password") {
      req.body[key] = xss(req.body[key]);
    }
  });
  next();
};

module.exports = xssMiddleware;