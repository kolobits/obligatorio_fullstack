const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ message: 'unauthorized invalid token provided' });
    }

    try {
        const verified = jwt.verify(token, process.env.AUTH_SECRET_KEY);
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({ message: 'unauthorized invalid token provided' });
    }
};

module.exports = authMiddleware;