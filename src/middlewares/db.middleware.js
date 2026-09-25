const connectMongoDB = require("../models/mongo.client");

const dbMiddleware = async (req, res, next) => {
    try {
        await connectMongoDB();
        next();
    } catch (error) {
        console.error("Ha ocurrido un error al conectarse a MongoDB", error);
        res.status(503).json({message: "Base de datos no disponible"}); 
    }
};

module.exports = dbMiddleware;