const Viaje = require("../models/viaje.model");
const connectToRedis = require("../services/redis.service");

const _getViajesRedisKey = (userId) => `userId:${userId}-viajes`;

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
    const redisKey = _getViajesRedisKey(userId);

    let viajes = await redisClient.get(redisKey);

    if (!viajes) {
        viajes = await Viaje.find({ userId }).sort({ createdAt: -1 });
        await redisClient.set(redisKey, viajes, { ex: 3600 });
    }

    const total = viajes.length;
    const skip = (page - 1) * limit;
    const data = viajes.slice(skip, skip + limit);

    return {
        data,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
    };
};
const countViajesByUser = async (userId) => {
  return await Viaje.countDocuments({ userId });
};

module.exports = {
  findViaje,
  createViaje,
  deleteViaje,
  updateViaje,
  getViajesPaginated,
  countViajesByUser,
};
