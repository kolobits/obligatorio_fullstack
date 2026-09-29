const mongoose = require("mongoose");

let connectionPromise = null;

const connectMongoDB = async () => {

    if(mongoose.connection.readyState === 1){
        return mongoose.connection;
    }

    if(!connectionPromise){
        const MONGODB_CONNECTION_STRING = process.env.MONGODB_CONNECTION_STRING;
        const MONGODB_DATABASE_NAME = process.env.MONGODB_DATABASE_NAME;
        const MONGODB_CONNECTION_TIMEOUT = process.env.MONGODB_CONNECTION_TIMEOUT;

        connectionPromise = mongoose.connect(MONGODB_CONNECTION_STRING, {
                dbName: MONGODB_DATABASE_NAME,
                serverSelectionTimeoutMS: MONGODB_CONNECTION_TIMEOUT
            })
            .then((conn) => {
                console.log("Conexion a mongo db establecida correctamente");
                return conn;
            })
            .catch((error) => {
                console.error("Ocurrio un error al conectarse a MongoDB", error);
                connectionPromise = null;
                throw error;
            })
    }
    return connectionPromise;
};

module.exports = connectMongoDB;