const { findUserById } = require("../repositories/user.repository");

const adminMiddleware = async (req, res, next) => {
    try {
        const usuario = await findUserById(req.user.id);
        if (!usuario || usuario.rol !== "admin") {
            return res.status(403).json({ message: "Esta acción requiere rol de administrador" });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: "Ha ocurrido un error", error });
    }
};

module.exports = adminMiddleware;