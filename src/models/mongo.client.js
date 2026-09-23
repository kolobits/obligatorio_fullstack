const mongoose = require("mongoose");

const connectMongoDB = async () => {
    const MONGODB_CONNECTION_STRING = process.env.MONGODB_CONNECTION_STRING;
    const MONGODB_DATABASE_NAME = process.env.MONGODB_DATABASE_NAME;
    const MONGODB_CONNECTION_TIMEOUT = process.env.MONGODB_CONNECTION_TIMEOUT;

    try {
        await mongoose.connect(`${MONGODB_CONNECTION_STRING}/${MONGODB_DATABASE_NAME}`,{
            serverSelectionTimeoutMS:MONGODB_CONNECTION_TIMEOUT
        });
        console.log("Conexion a mongo db establecida correctamente");
    } catch (error) {
        console.error("Ocurrio un error al conectarse a MongoDB", error);
    }
};


module.exports = connectMongoDB;