const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token || token !== 'Bearer mysecrettoken') {
        return res.status(401).json({ message: 'unauthorized invalid token provided' });
    }
    next();
};

module.exports = authMiddleware;