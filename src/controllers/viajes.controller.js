const {
  getViajesPaginated,
  findViaje,
  createViaje,
  deleteViaje,
  updateViaje,
  countViajesByUser,
  getClimaCache,
  setClimaCache,
} = require("../repositories/viaje.repository");
const { findUserById } = require("../repositories/user.repository");
const { findCategoria } = require("../repositories/categoria.repository");
const {
  getCoordenadasOSM,
  getPuntosDeInteres,
  getRuta,
} = require("../services/osm.service");
const {
  calcularDiasHasta,
  armarPlanDeViaje,
} = require("../services/itinerario.service");

const LIMITE_VIAJES_PLUS = 4;

const getViajesController = async (req, res) => {
  const { id } = req.user;
  const { estado, categoria } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;

  try {
    const result = await getViajesPaginated(id, { estado, categoria }, page, limit);
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Ha ocurrido un error" });
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
    console.error(error);
    res.status(500).json({ message: "Ha ocurrido un error" });
  }
};

const postViajeController = async (req, res) => {
  const { body, user } = req;

  try {
    const usuario = await findUserById(user.id);

    if (usuario.perfil === "plus") {
      const cantidadViajes = await countViajesByUser(user.id);

      if (cantidadViajes >= LIMITE_VIAJES_PLUS) {
        return res.status(400).json({
          message: `Alcanzaste el límite de ${LIMITE_VIAJES_PLUS} viajes del plan plus. Cambiá a premium para agregar más.`,
        });
      }
    }

    if (body.categoria) {
      const categoria = await findCategoria(body.categoria);
      if (!categoria) {
        return res.status(400).json({ message: "La categoría indicada no existe" });
      }
    }

    const nuevoViaje = await createViaje(body, user.id);
    res.status(201).json(nuevoViaje);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Ha ocurrido un error" });
  }
};

const putViajeController = async (req, res) => {
  const viajeId = req.params.id;
  const { body } = req;
  const { id } = req.user;

  try {
    if (body.categoria) {
      const categoria = await findCategoria(body.categoria);
      if (!categoria) {
        return res.status(400).json({ message: "La categoría indicada no existe" });
      }
    }

    const viaje = await updateViaje(viajeId, id, body);
    if (!viaje) {
      return res.status(404).json({ message: "Viaje no encontrado" });
    }
    res.status(200).json(viaje);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Ha ocurrido un error" });
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
    console.error(error);
    res.status(500).json({ message: "Ha ocurrido un error" });
  }
};

const getClimaViajeController = async (req, res) => {
  const viajeId = req.params.id;
  const { id } = req.user;

  try {
    const viaje = await findViaje(viajeId, id);
    if (!viaje) {
      return res.status(404).json({ message: "Viaje no encontrado" });
    }

    const diasHastaInicio = calcularDiasHasta(viaje.fechaInicio);
    if (diasHastaInicio < 0) {
      return res
        .status(400)
        .json({ message: "El viaje ya pasó, no hay pronóstico disponible" });
    }

    const climaGuardado = await getClimaCache(viajeId);
    if (climaGuardado) {
      return res.status(200).json(climaGuardado);
    }

    const plan = await armarPlanDeViaje(viaje, diasHastaInicio);
    if (!plan) {
      return res
        .status(404)
        .json({ message: `No se encontró la ubicación "${viaje.destino}"` });
    }

    // Solo guardamos en caché si la IA respondió, así se reintenta la próxima vez
    if (plan.recomendacion) {
      await setClimaCache(viajeId, plan);
    }

    res.status(200).json(plan);
  } catch (error) {
    console.error(error?.response?.data || error.message);
    res
      .status(500)
      .json({ message: "Ha ocurrido un error al consultar el clima" });
  }
};

const getDistanciaViajeController = async (req, res) => {
  const viajeId = req.params.id;
  const { id } = req.user;
  const { origen } = req.query;

  if (!origen) {
    return res.status(400).json({
      message: "Falta el parámetro 'origen' (ciudad desde donde salís)",
    });
  }

  try {
    const viaje = await findViaje(viajeId, id);
    if (!viaje) {
      return res.status(404).json({ message: "Viaje no encontrado" });
    }

    const [coordenadasOrigen, coordenadasDestino] = await Promise.all([
      getCoordenadasOSM(origen),
      getCoordenadasOSM(viaje.destino),
    ]);

    if (!coordenadasOrigen) {
      return res
        .status(404)
        .json({ message: `No se encontró la ubicación de origen "${origen}"` });
    }
    if (!coordenadasDestino) {
      return res
        .status(404)
        .json({ message: `No se encontró el destino "${viaje.destino}"` });
    }

    const resultado = await getRuta(coordenadasOrigen, coordenadasDestino);
    if (!resultado) {
      return res
        .status(404)
        .json({ message: "No se pudo calcular una ruta entre esos puntos" });
    }

    res.status(200).json({
      origen: coordenadasOrigen.nombre,
      destino: coordenadasDestino.nombre,
      ...resultado,
    });
  } catch (error) {
    console.error(error?.response?.data || error.message);
    res
      .status(500)
      .json({ message: "Ha ocurrido un error al calcular la distancia" });
  }
};

const getPuntosInteresViajeController = async (req, res) => {
  const viajeId = req.params.id;
  const { id } = req.user;

  try {
    const usuario = await findUserById(id);
    if (usuario.perfil !== "premium") {
      return res
        .status(403)
        .json({ message: "Esta función es exclusiva del plan premium" });
    }

    const viaje = await findViaje(viajeId, id);
    if (!viaje) {
      return res.status(404).json({ message: "Viaje no encontrado" });
    }

    const coordenadas = await getCoordenadasOSM(viaje.destino);
    if (!coordenadas) {
      return res
        .status(404)
        .json({ message: `No se encontró la ubicación "${viaje.destino}"` });
    }

    const puntos = await getPuntosDeInteres(
      coordenadas.latitude,
      coordenadas.longitude,
    );

    res.status(200).json({
      destino: coordenadas.nombre,
      puntosDeInteres: puntos.slice(0, 20),
    });
  } catch (error) {
    console.error(error?.response?.data || error.message);
    res
      .status(500)
      .json({ message: "Ha ocurrido un error al buscar puntos de interés" });
  }
};

module.exports = {
  getViajesController,
  getViajeController,
  postViajeController,
  putViajeController,
  deleteViajeController,
  getClimaViajeController,
  getDistanciaViajeController,
  getPuntosInteresViajeController,
};
