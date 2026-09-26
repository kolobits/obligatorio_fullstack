const {
  getViajesPaginated,
  findViaje,
  createViaje,
  deleteViaje,
  updateViaje,
  countViajesByUser,
} = require("../repositories/viaje.repository");

const { findUserById } = require("../repositories/user.repository");
const {
  getCoordenadasOSM,
  getPuntosDeInteres,
  getRuta,
  getRutaConParadas,
} = require("../services/osm.service");
const {
  getPronostico,
  getHistoricoPorAnios,
  resumirHistorico,
} = require("../services/weather.service");
const { askGeminiFlash, extraerTexto } = require("../services/gemini.service");

const LIMITE_VIAJES_PLUS = 4;
const MAX_DIAS_PRONOSTICO = 16;

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
    const usuario = await findUserById(user.id);

    if (usuario.perfil === "plus") {
      const cantidadViajes = await countViajesByUser(user.id);

      if (cantidadViajes >= LIMITE_VIAJES_PLUS) {
        return res.status(400).json({
          message: `Alcanzaste el límite de ${LIMITE_VIAJES_PLUS} viajes del plan plus. Cambiá a premium para agregar más.`,
        });
      }
    }

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

const getClimaViajeController = async (req, res) => {
  const viajeId = req.params.id;
  const { id } = req.user;

  try {
    const viaje = await findViaje(viajeId, id);

    if (!viaje) {
      return res.status(404).json({ message: "Viaje no encontrado" });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diasHastaInicio = Math.ceil(
      (viaje.fechaInicio - hoy) / (1000 * 60 * 60 * 24),
    );

    if (diasHastaInicio < 0) {
      return res
        .status(400)
        .json({ message: "El viaje ya pasó, no hay pronóstico disponible" });
    }

    const coordenadas = await getCoordenadasOSM(viaje.destino);

    if (!coordenadas) {
      return res
        .status(404)
        .json({ message: `No se encontró la ubicación "${viaje.destino}"` });
    }

    const fechaInicioStr = viaje.fechaInicio.toISOString().split("T")[0];
    const fechaFinStr = viaje.fechaFin.toISOString().split("T")[0];

    const usuario = await findUserById(id);
    const puntos = await getPuntosDeInteres(
      coordenadas.latitude,
      coordenadas.longitude,
    );
    const lugaresDestacados = puntos.slice(0, 3);

    let recomendacion = null;
    let recorrido = null;

    const armarRecorrido = async () => {
      if (usuario.perfil === "premium" && lugaresDestacados.length > 1) {
        const puntosRuta = [
          { latitude: coordenadas.latitude, longitude: coordenadas.longitude },
          ...lugaresDestacados,
        ];
        recorrido = await getRutaConParadas(puntosRuta);
      }
    };

    if (diasHastaInicio <= MAX_DIAS_PRONOSTICO) {
      const pronostico = await getPronostico(
        coordenadas.latitude,
        coordenadas.longitude,
        fechaInicioStr,
        fechaFinStr,
      );

      try {
        const nombresLugares = lugaresDestacados
          .map((p) => `${p.nombre} (${p.tipo})`)
          .join(", ");
        const prompt = `Sos un asistente de viajes. Este es el pronóstico diario para ${coordenadas.nombre} entre ${fechaInicioStr} y ${fechaFinStr} (temperaturas máx/mín en °C, precipitación en mm): ${JSON.stringify(pronostico)}. Estos son lugares de interés reales cerca del destino: ${nombresLugares}. Armá una recomendación breve (máximo 4 líneas, en español) de qué día conviene visitar cuál de esos lugares según el clima (aire libre si está despejado, bajo techo si llueve), mencionando la temperatura o condición que lo justifica. Usá solo los lugares de la lista, no inventes otros.`;
        const data = await askGeminiFlash(prompt);
        recomendacion = extraerTexto(data);
      } catch (error) {
        console.error(
          "Error al pedir recomendación a Gemini:",
          error?.response?.data || error.message,
        );
      }

      await armarRecorrido();

      return res.status(200).json({
        tipo: "pronostico",
        destino: coordenadas.nombre,
        pronostico,
        recomendacion,
        lugaresDestacados,
        recorrido,
      });
    }

    // Viaje lejano: estimación basada en el historial
    const historico = await getHistoricoPorAnios(
      coordenadas.latitude,
      coordenadas.longitude,
      fechaInicioStr,
      fechaFinStr,
    );
    const resumen = resumirHistorico(historico);

    try {
      const nombresLugares = lugaresDestacados
        .map((p) => `${p.nombre} (${p.tipo})`)
        .join(", ");
      const prompt = `Sos un asistente de viajes. El viaje a ${coordenadas.nombre} es dentro de ${diasHastaInicio} días, muy lejos para un pronóstico exacto. Historial de los últimos ${resumen.aniosAnalizados} años para estas fechas: máxima promedio ${resumen.temperaturaMaximaPromedio}°C, mínima promedio ${resumen.temperaturaMinimaPromedio}°C, probabilidad histórica de lluvia ${resumen.probabilidadDeLluvia}%. Estos son lugares de interés reales cerca del destino: ${nombresLugares}. Escribí una estimación breve del clima esperable (aclarando que es histórico, no exacto) y recomendá cuáles de esos lugares conviene priorizar según esa tendencia. Usá solo los lugares de la lista, no inventes otros.`;
      const data = await askGeminiFlash(prompt);
      recomendacion = extraerTexto(data);
    } catch (error) {
      console.error(
        "Error al pedir estimación a Gemini:",
        error?.response?.data || error.message,
      );
    }

    await armarRecorrido();

    res.status(200).json({
      tipo: "estimacion_historica",
      destino: coordenadas.nombre,
      resumenHistorico: resumen,
      recomendacion,
      lugaresDestacados,
      recorrido,
    });
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
        return res.status(400).json({ message: "Falta el parámetro 'origen' (ciudad desde donde salís)" });
    }

    try {
        const viaje = await findViaje(viajeId, id);
        if (!viaje) return res.status(404).json({ message: "Viaje no encontrado" });

        const [coordenadasOrigen, coordenadasDestino] = await Promise.all([
            getCoordenadasOSM(origen),
            getCoordenadasOSM(viaje.destino)
        ]);

        if (!coordenadasOrigen) return res.status(404).json({ message: `No se encontró la ubicación de origen "${origen}"` });
        if (!coordenadasDestino) return res.status(404).json({ message: `No se encontró el destino "${viaje.destino}"` });

        const resultado = await getRuta(coordenadasOrigen, coordenadasDestino);
        if (!resultado) return res.status(404).json({ message: "No se pudo calcular una ruta entre esos puntos" });

        res.status(200).json({
            origen: coordenadasOrigen.nombre,
            destino: coordenadasDestino.nombre,
            ...resultado
        });
    } catch (error) {
        console.error(error?.response?.data || error.message);
        res.status(500).json({ message: "Ha ocurrido un error al calcular la distancia" });
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
  deleteViajeController,
  putViajeController,
  getClimaViajeController,
  getDistanciaViajeController,
  getPuntosInteresViajeController,
};
