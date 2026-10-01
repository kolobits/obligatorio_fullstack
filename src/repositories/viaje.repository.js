const Viaje = require("../models/viaje.model");
const connectToRedis = require("../services/redis.service");

const _getClimaRedisKey = (viajeId) => `viajeId:${viajeId}-clima`;

const _invalidarCacheClima = async (viajeId) => {
  try {
    const redisClient = connectToRedis();
    await redisClient.del(_getClimaRedisKey(viajeId));
  } catch (error) {
    console.error("Error al invalidar el clima en Redis:", error.message);
  }
};

const findViaje = async (viajeId, userId) => {
  return await Viaje.findOne({ _id: viajeId, userId: userId });
};

const createViaje = async (data, userId) => {
  const nuevoViaje = new Viaje({ ...data, userId: userId });
  return await nuevoViaje.save();
};

const updateViaje = async (viajeId, userId, payload) => {
  const viaje = await Viaje.findOne({ _id: viajeId, userId: userId });

  if (viaje) {
    Object.entries(payload).forEach(([key, value]) => {
      viaje[key] = value;
    });
    await viaje.save();

    await _invalidarCacheClima(viajeId);
  }

  return viaje;
};

const deleteViaje = async (viajeId, userId) => {
  const resultado = await Viaje.deleteOne({ _id: viajeId, userId: userId });

  if (resultado.deletedCount > 0) {
    await _invalidarCacheClima(viajeId);
  }

  return resultado;
};

const getViajesPaginated = async (userId, filtros, page, limit) => {
  const query = { userId: userId };

  if (filtros.estado) {
    query.estado = filtros.estado;
  }
  if (filtros.categoria) {
    query.categoria = filtros.categoria;
  }

  const skip = (page - 1) * limit;

  const [viajes, total] = await Promise.all([
    Viaje.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Viaje.countDocuments(query),
  ]);

  return {
    data: viajes,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

const countViajesByUser = async (userId) => {
  return await Viaje.countDocuments({ userId: userId });
};

const getClimaCache = async (viajeId) => {
  try {
    const redisClient = connectToRedis();
    return await redisClient.get(_getClimaRedisKey(viajeId));
  } catch (error) {
    console.error("Error al leer el clima de Redis:", error.message);
    return null;
  }
};

const setClimaCache = async (viajeId, clima) => {
  try {
    const redisClient = connectToRedis();
    await redisClient.set(_getClimaRedisKey(viajeId), clima, { ex: 3600 });
  } catch (error) {
    console.error("Error al guardar el clima en Redis:", error.message);
  }
};

module.exports = {
  findViaje,
  createViaje,
  updateViaje,
  deleteViaje,
  getViajesPaginated,
  countViajesByUser,
  getClimaCache,
  setClimaCache,
};