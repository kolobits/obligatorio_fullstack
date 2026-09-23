const {
    getViajesPaginated,
    findViaje,
    createViaje,
    deleteViaje,
    updateViaje
} = require("../repositories/viaje.repository");

const getViajesController = async (req, res) => {
    const { id } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;

    try {
        const result = await getViajesPaginated(id, page, limit);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: "Ha ocurrido un error", error });
    }
};

const getViajeController = async (req, res) => {
    const viajeId = req.params.id;
    const { id } = req.user;
    try {
        const viaje = await findViaje(viajeId, id);
        if (!viaje) {
            return res.status(404).json({ message: "Viaje no encontrado" });
        }
        res.status(200).json(viaje);
    } catch (error) {
        res.status(500).json({ message: "Ha ocurrido un error", error });
    }
};

const postViajeController = async (req, res) => {
    const { body, user } = req;
    try {
        const nuevoViaje = await createViaje(body, user.id);
        res.status(201).json(nuevoViaje);
    } catch (error) {
        res.status(500).json({ message: "Ha ocurrido un error", error });
    }
};

const deleteViajeController = async (req, res) => {
    const viajeId = req.params.id;
    const { id } = req.user;
    try {
        const resultado = await deleteViaje(viajeId, id);
        if (resultado.deletedCount === 0) {
            return res.status(404).json({ message: "Viaje no encontrado" });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: "Ha ocurrido un error", error });
    }
};

const putViajeController = async (req, res) => {
    const viajeId = req.params.id;
    const { body } = req;
    const { id } = req.user;
    try {
        const viaje = await updateViaje(viajeId, id, body);
        if (!viaje) {
            return res.status(404).json({ message: "Viaje no encontrado" });
        }
        res.status(200).json(viaje);
    } catch (error) {
        res.status(500).json({ message: "Ha ocurrido un error", error });
    }
};

module.exports = {
    getViajesController,
    getViajeController,
    postViajeController,
    deleteViajeController,
    putViajeController
};