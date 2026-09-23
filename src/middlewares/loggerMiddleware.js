const logRequest = require("../utils/logger");

const loggerMiddleware = (req, res, next) => {
    logRequest(req);
    next();
};

module.exports = loggerMiddleware;