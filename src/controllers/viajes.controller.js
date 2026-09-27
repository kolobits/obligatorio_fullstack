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
//const { askGeminiFlash, extraerTexto } = require("../services/gemini.service");
const { askGroq, extraerTexto } = require("../services/groq.service");

const LIMITE_VIAJES_PLUS = 4;
const MAX_DIAS_PRONOSTICO = 16;

const TIPOS_INDOOR_ITINERARIO = new Set([
  "entertainment.museum",
  "entertainment.culture.gallery",
  "entertainment.aquarium",
]);

const seleccionarDiversificado = (puntos, cantidad) => {
  const porTipo = new Map();
  for (const p of puntos) {
    if (!porTipo.has(p.tipo)) porTipo.set(p.tipo, []);
    porTipo.get(p.tipo).push(p);
  }
  const grupos = [...porTipo.values()];

  const seleccion = [];
  let ronda = 0;
  while (seleccion.length < cantidad && grupos.some((g) => ronda < g.length)) {
    for (const grupo of grupos) {
      if (seleccion.length >= cantidad) break;
      if (grupo[ronda]) seleccion.push(grupo[ronda]);
    }
    ronda++;
  }

  return seleccion
    .sort((a, b) => a.distanciaKm - b.distanciaKm)
    .slice(0, cantidad);
};

const armarItinerarioPorDia = (dias, lugares) => {
  const pool = [...lugares];
  const resultado = dias.map((dia) => ({ ...dia, lugares: [] }));

  if (resultado.length === 0) return resultado;

  let cursor = 0;
  while (pool.length > 0) {
    const dia = resultado[cursor % resultado.length];
    let idx = -1;

    if (dia.lluvioso === true) {
      idx = pool.findIndex((l) => TIPOS_INDOOR_ITINERARIO.has(l.tipo));
    } else if (dia.lluvioso === false) {
      idx = pool.findIndex((l) => !TIPOS_INDOOR_ITINERARIO.has(l.tipo));
    }
    if (idx === -1) idx = 0;

    dia.lugares.push({ ...pool.splice(idx, 1)[0], fecha: dia.fecha });
    cursor++;
  }

  return resultado;
};

const _diasDelViaje = (fechaInicio, fechaFin) => {
  const dias = [];
  const cursor = new Date(fechaInicio);
  cursor.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin);
  fin.setHours(0, 0, 0, 0);

  while (cursor <= fin) {
    dias.push({ fecha: cursor.toISOString().split("T")[0], lluvioso: null });
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
};

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

    const diasDelViaje = _diasDelViaje(viaje.fechaInicio, viaje.fechaFin);
    const LUGARES_POR_DIA = 2;

    const puntos = await getPuntosDeInteres(
      coordenadas.latitude,
      coordenadas.longitude,
    );
    const soloAtracciones = puntos.filter(
      (p) => !p.tipo?.startsWith("catering."),
    );
    const lugaresDestacados = seleccionarDiversificado(
      soloAtracciones,
      diasDelViaje.length * LUGARES_POR_DIA,
    );

    let recomendacion = null;
    let recorrido = null;

    const armarRecorrido = async (lugaresEnOrden) => {
      if (lugaresEnOrden.length > 1) {
        const puntosRuta = [
          { latitude: coordenadas.latitude, longitude: coordenadas.longitude },
          ...lugaresEnOrden,
        ];
        recorrido = await getRutaConParadas(puntosRuta);
      }
    };

    const responderConHistorico = async () => {
      const historico = await getHistoricoPorAnios(
        coordenadas.latitude,
        coordenadas.longitude,
        fechaInicioStr,
        fechaFinStr,
      );
      const resumen = resumirHistorico(historico);

      const itinerarioPorDia = armarItinerarioPorDia(
        diasDelViaje,
        lugaresDestacados,
      );
      const lugaresOrdenados = itinerarioPorDia.flatMap((d) => d.lugares);

      try {
        const asignacion = itinerarioPorDia
          .map(
            (d) =>
              `${d.fecha}: ${d.lugares.map((l) => l.nombre).join(", ") || "sin plan puntual"}`,
          )
          .join(" | ");
        const prompt = `Sos un asistente de viajes. El viaje a ${coordenadas.nombre} es dentro de ${diasHastaInicio} días, muy lejos para un pronóstico exacto. Historial de los últimos ${resumen.aniosAnalizados} años para estas fechas: máxima promedio ${resumen.temperaturaMaximaPromedio}°C, mínima promedio ${resumen.temperaturaMinimaPromedio}°C, probabilidad histórica de lluvia ${resumen.probabilidadDeLluvia}%. Ya se repartieron estos lugares de interés reales entre los días del viaje: ${asignacion}. Escribí una estimación breve del clima esperable (aclarando que es histórico, no exacto) y comentá brevemente por qué conviene ese reparto. No cambies el reparto ni inventes otros lugares.`;
        const data = await askGroq(prompt);
        recomendacion = extraerTexto(data);
      } catch (error) {
        console.error(
          "Error al pedir estimación a Gemini:",
          error?.response?.data || error.message,
        );
      }

      await armarRecorrido(lugaresOrdenados);

      return res.status(200).json({
        tipo: "estimacion_historica",
        destino: coordenadas.nombre,
        destinoCoordenadas: {
          latitude: coordenadas.latitude,
          longitude: coordenadas.longitude,
        },
        resumenHistorico: resumen,
        recomendacion,
        lugaresDestacados: lugaresOrdenados,
        itinerarioPorDia,
        recorrido,
      });
    };

    const diasHastaFin = Math.ceil(
      (viaje.fechaFin - hoy) / (1000 * 60 * 60 * 24),
    );

    const puedeUsarPronostico =
      diasHastaInicio >= 0 && diasHastaFin <= MAX_DIAS_PRONOSTICO;

    if (puedeUsarPronostico) {
      let pronostico;
      try {
        pronostico = await getPronostico(
          coordenadas.latitude,
          coordenadas.longitude,
          fechaInicioStr,
          fechaFinStr,
        );
      } catch (error) {
        console.error(
          "Error al pedir pronóstico a Open-Meteo:",
          error?.response?.data || error.message,
        );
        return await responderConHistorico();
      }

      const indicePorFecha = new Map(
        pronostico.time.map((fecha, i) => [fecha, i]),
      );
      const dias = diasDelViaje.map((dia) => {
        const i = indicePorFecha.get(dia.fecha);
        return {
          ...dia,
          lluvioso:
            i !== undefined ? pronostico.precipitation_sum[i] >= 1 : null,
        };
      });
      const itinerarioPorDia = armarItinerarioPorDia(dias, lugaresDestacados);
      const lugaresOrdenados = itinerarioPorDia.flatMap((d) => d.lugares);

      try {
        const asignacion = itinerarioPorDia
          .map(
            (d) =>
              `${d.fecha}: ${d.lugares.map((l) => l.nombre).join(", ") || "sin plan puntual"}`,
          )
          .join(" | ");
        const prompt = `Sos un asistente de viajes. Este es el pronóstico diario para ${coordenadas.nombre} entre ${fechaInicioStr} y ${fechaFinStr} (temperaturas máx/mín en °C, precipitación en mm): ${JSON.stringify(pronostico)}. Ya se repartieron estos lugares de interés reales entre los días del viaje: ${asignacion}. Escribí una recomendación breve (máximo 4 líneas, en español) explicando por qué ese reparto tiene sentido según el clima de cada día (aire libre si está despejado, bajo techo si llueve), mencionando la temperatura o condición que lo justifica. No cambies el reparto ni inventes otros lugares.`;
        const data = await askGroq(prompt);
        recomendacion = extraerTexto(data);
      } catch (error) {
        console.error(
          "Error al pedir recomendación a Gemini:",
          error?.response?.data || error.message,
        );
      }

      await armarRecorrido(lugaresOrdenados);

      return res.status(200).json({
        tipo: "pronostico",
        destino: coordenadas.nombre,
        destinoCoordenadas: {
          latitude: coordenadas.latitude,
          longitude: coordenadas.longitude,
        },
        pronostico,
        recomendacion,
        lugaresDestacados: lugaresOrdenados,
        itinerarioPorDia,
        recorrido,
      });
    }

    return await responderConHistorico();
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
    return res
      .status(400)
      .json({
        message: "Falta el parámetro 'origen' (ciudad desde donde salís)",
      });
  }

  try {
    const viaje = await findViaje(viajeId, id);
    if (!viaje) return res.status(404).json({ message: "Viaje no encontrado" });

    const [coordenadasOrigen, coordenadasDestino] = await Promise.all([
      getCoordenadasOSM(origen),
      getCoordenadasOSM(viaje.destino),
    ]);

    if (!coordenadasOrigen)
      return res
        .status(404)
        .json({ message: `No se encontró la ubicación de origen "${origen}"` });
    if (!coordenadasDestino)
      return res
        .status(404)
        .json({ message: `No se encontró el destino "${viaje.destino}"` });

    const resultado = await getRuta(coordenadasOrigen, coordenadasDestino);
    if (!resultado)
      return res
        .status(404)
        .json({ message: "No se pudo calcular una ruta entre esos puntos" });

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
  deleteViajeController,
  putViajeController,
  getClimaViajeController,
  getDistanciaViajeController,
  getPuntosInteresViajeController,
};
