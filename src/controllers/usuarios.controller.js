const {
  findUserById,
  updatePerfil,
} = require("../repositories/user.repository");

const putPlanController = async (req, res) => {
  const { id } = req.user;

  try {
    const usuario = await findUserById(id);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (usuario.perfil !== "plus") {
      return res
        .status(400)
        .json({
          message: "Solo los usuarios en plan plus pueden cambiar a premium",
        });
    }

    const actualizado = await updatePerfil(id, "premium");

    res.status(200).json({
      id: actualizado._id,
      username: actualizado.username,
      perfil: actualizado.perfil,
    });
  } catch (error) {
    res.status(500).json({ message: "Ha ocurrido un error", error });
  }
};

const getPerfilController = async (req, res) => {
  const { id } = req.user;

  try {
    const usuario = await findUserById(id);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({
      id: usuario._id,
      username: usuario.username,
      perfil: usuario.perfil,
    });
  } catch (error) {
    res.status(500).json({ message: "Ha ocurrido un error", error });
  }
};

module.exports = { putPlanController, getPerfilController };
