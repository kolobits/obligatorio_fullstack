const Viaje = require("../models/viaje.model");

const getViajes = async (userId) => {
    return await Viaje.find({ userId: userId });
};

const findViaje = async (viajeId, userId) => {
    return await Viaje.findOne({ _id: viajeId, userId: userId });
};

const createViaje = async (data, userId) => {
    const nuevoViaje = new Viaje({ ...data, userId: userId });
    return await nuevoViaje.save();
};

const deleteViaje = async (viajeId, userId) => {
    return await Viaje.deleteOne({ _id: viajeId, userId: userId });
};

const updateViaje = async (viajeId, userId, payload) => {
    const viaje = await Viaje.findOne({ _id: viajeId, userId: userId });

    if (viaje) {
        Object.entries(payload).forEach(([key, value]) => {
            viaje[key] = value;
        });
        await viaje.save();
    }
    return viaje;
};

const getViajesPaginated = async (userId, page = 1, limit = 5) => {
    const skip = (page - 1) * limit;

    const [viajes, total] = await Promise.all([
        Viaje.find({ userId }).skip(skip).limit(limit),
        Viaje.countDocuments({ userId })
    ]);

    return {
        data: viajes,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
    };
};

module.exports = {
    getViajes,
    findViaje,
    createViaje,
    deleteViaje,
    updateViaje,
    getViajesPaginated
};