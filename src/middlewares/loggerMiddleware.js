const { logRequest } = require('../utils/logger');

const loggerMiddleware = (req, res, next) => {
    res.on('finish', () => {
        logRequest(req.method, req.path, res.statusCode);
    });
    next();
}

module.exports = loggerMiddleware;