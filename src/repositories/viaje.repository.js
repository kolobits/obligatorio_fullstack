const Viaje = require("../models/viaje.model");
const connectToRedis = require("../services/redis.service");

const _getViajesRedisKey = (userId) => `userId:${userId}-todos`
const _getViajesPaginatedRedisKey = (userId, page, limit) => `userId:${userId}-viajes:page:${page}:limit:${limit}`;

const getViajes = async (userId) => {
    try{
        await connectToRedis();
        console.log("Conexión a Redis establecida correctamente");
    }catch(error){
        console.error("Ocurrió un error al conectarse a Redis", error);
    }
    const redisClient = await connectToRedis();
    const redisKey = _getViajesRedisKey(userId);
    let viajes = await redisClient.get(redisKey);

    if (!viajes) {
        viajes = await Viaje.find({ userId: userId });
        await redisClient.set(redisKey, JSON.stringify(viajes), { ex: 3600 });

    return viajes;
}};

const findViaje = async (viajeId, userId) => {
    return await Viaje.findOne({ _id: viajeId, userId: userId });
};

const createViaje = async (data, userId) => {
    const nuevoViaje = new Viaje({ ...data, userId: userId });

    const redisClient = await connectToRedis();
    redisClient.del(_getViajesRedisKey(userId));

    return await nuevoViaje.save();
};

const deleteViaje = async (viajeId, userId) => {
    const redisClient = await connectToRedis();
    redisClient.del(_getViajesRedisKey(userId));

    return await Viaje.deleteOne({ _id: viajeId, userId: userId });
};

const updateViaje = async (viajeId, userId, payload) => {
    const viaje = await Viaje.findOne({ _id: viajeId, userId: userId });

    if (viaje) {
        Object.entries(payload).forEach(([key, value]) => {
            viaje[key] = value;
        });
        await viaje.save();

        const redisClient = await connectToRedis();
        redisClient.del(_getViajesRedisKey(userId));
    }
    return viaje;
};

const getViajesPaginated = async (userId, page = 1, limit = 5) => {
    const redisClient = await connectToRedis();
    const redisKey = _getViajesPaginatedRedisKey(userId, page, limit);
    let result = await redisClient.get(redisKey);

    if (!result) {
        const skip = (page - 1) * limit;

        const [viajes, total] = await Promise.all([
            Viaje.find({ userId }).skip(skip).limit(limit),
            Viaje.countDocuments({ userId })
        ]);

        result = {
            data: viajes,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        };

        redisClient.set(redisKey, JSON.stringify(result), { ex: 3600 });
    }else{
        result = JSON.parse(result);
    }
    return result;
};

module.exports = {
    getViajes,
    findViaje,
    createViaje,
    deleteViaje,
    updateViaje,
    getViajesPaginated
};