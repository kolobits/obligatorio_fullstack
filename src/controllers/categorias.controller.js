const {
    getCategorias,
    findCategoria,
    findCategoriaByNombre,
    createCategoria,
    updateCategoria,
    deleteCategoria,
    contarViajesPorCategoria
} = require("../repositories/categoria.repository");

const getCategoriasController = async (req, res) => {
    try {
        const categorias = await getCategorias();
        res.status(200).json(categorias);
    } catch (error) {
        res.status(500).json({ message: "Ha ocurrido un error", error });
    }
};

const getCategoriaController = async (req, res) => {
    const categoriaId = req.params.id;
    try {
        const categoria = await findCategoria(categoriaId);
        if (!categoria) return res.status(404).json({ message: "Categoría no encontrada" });
        res.status(200).json(categoria);
    } catch (error) {
        res.status(500).json({ message: "Ha ocurrido un error", error });
    }
};

const postCategoriaController = async (req, res) => {
    const { body } = req;
    try {
        const existente = await findCategoriaByNombre(body.nombre);
        if (existente) {
            return res.status(400).json({ message: "Ya existe una categoría con ese nombre" });
        }
        const nuevaCategoria = await createCategoria(body);
        res.status(201).json(nuevaCategoria);
    } catch (error) {
        res.status(500).json({ message: "Ha ocurrido un error", error });
    }
};

const putCategoriaController = async (req, res) => {
    const categoriaId = req.params.id;
    const { body } = req;
    try {
        const categoria = await updateCategoria(categoriaId, body);
        if (!categoria) return res.status(404).json({ message: "Categoría no encontrada" });
        res.status(200).json(categoria);
    } catch (error) {
        res.status(500).json({ message: "Ha ocurrido un error", error });
    }
};

const deleteCategoriaController = async (req, res) => {
    const categoriaId = req.params.id;
    try {
        const categoria = await findCategoria(categoriaId);
        if (!categoria) return res.status(404).json({ message: "Categoría no encontrada" });

        const viajesAsociados = await contarViajesPorCategoria(categoriaId);
        if (viajesAsociados > 0) {
            return res.status(400).json({
                message: `No se puede borrar: hay ${viajesAsociados} viaje(s) usando esta categoría`
            });
        }

        await deleteCategoria(categoriaId);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: "Ha ocurrido un error", error });
    }
};

module.exports = {
    getCategoriasController,
    getCategoriaController,
    postCategoriaController,
    putCategoriaController,
    deleteCategoriaController
};