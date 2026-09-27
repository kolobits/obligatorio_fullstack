const Categoria = require("../models/categoria.model");
const Viaje = require("../models/viaje.model");

const getCategorias = async () => {
    return await Categoria.find();
};

const findCategoria = async (categoriaId) => {
    return await Categoria.findById(categoriaId);
};

const findCategoriaByNombre = async (nombre) => {
    return await Categoria.findOne({ nombre });
};

const createCategoria = async (data) => {
    const nuevaCategoria = new Categoria(data);
    return await nuevaCategoria.save();
};

const updateCategoria = async (categoriaId, payload) => {
    const categoria = await Categoria.findById(categoriaId);
    if (categoria) {
        Object.entries(payload).forEach(([key, value]) => {
            categoria[key] = value;
        });
        await categoria.save();
    }
    return categoria;
};

const deleteCategoria = async (categoriaId) => {
    return await Categoria.deleteOne({ _id: categoriaId });
};

const contarViajesPorCategoria = async (categoriaId) => {
    return await Viaje.countDocuments({ categoria: categoriaId });
};

module.exports = {
    getCategorias,
    findCategoria,
    findCategoriaByNombre,
    createCategoria,
    updateCategoria,
    deleteCategoria,
    contarViajesPorCategoria
};