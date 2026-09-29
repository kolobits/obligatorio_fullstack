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
        console.error(error);
        res.status(500).json({ message: "Ha ocurrido un error" });
    }
};

const getCategoriaController = async (req, res) => {
    const categoriaId = req.params.id;
    try {
        const categoria = await findCategoria(categoriaId);
        if (!categoria) return res.status(404).json({ message: "Categoría no encontrada" });
        res.status(200).json(categoria);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ha ocurrido un error" });
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
        console.error(error);
        res.status(500).json({ message: "Ha ocurrido un error" });
    }
};

const putCategoriaController = async (req, res) => {
    const categoriaId = req.params.id;
    const { body } = req;
    try {
        if (body.nombre) {
            const existente = await findCategoriaByNombre(body.nombre);
            if (existente && existente._id.toString() !== categoriaId) {
                return res.status(400).json({ message: "Ya existe una categoría con ese nombre" });
            }
        }

        const categoria = await updateCategoria(categoriaId, body);
        if (!categoria) return res.status(404).json({ message: "Categoría no encontrada" });
        res.status(200).json(categoria);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ha ocurrido un error" });
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
        console.error(error);
        res.status(500).json({ message: "Ha ocurrido un error" });
    }
};

module.exports = {
    getCategoriasController,
    getCategoriaController,
    postCategoriaController,
    putCategoriaController,
    deleteCategoriaController
};