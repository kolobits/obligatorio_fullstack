const {
    getCoordenadasOSM,
    getPuntosDeInteres,
    getRutaConParadas,
} = require("./osm.service");
const {
    getPronostico,
    getHistoricoPorAnios,
    resumirHistorico,
} = require("./weather.service");
const { askGroq, extraerTexto } = require("./groq.service");

const MAX_DIAS_PRONOSTICO = 16;
const LUGARES_POR_DIA = 2;
const MS_POR_DIA = 1000 * 60 * 60 * 24;
const TIPOS_BAJO_TECHO = ["entertainment.museum", "entertainment.culture"];

const REGLAS_PROMPT =
    "No cambies el reparto, no inventes otros lugares y no describas los lugares. Respondé en texto plano, sin markdown.";

const calcularDiasHasta = (fecha) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.ceil((fecha - hoy) / MS_POR_DIA);
};

const formatearFecha = (fecha) => fecha.toISOString().split("T")[0];

const obtenerDiasDelViaje = (fechaInicio, fechaFin) => {
    const dias = [];
    const fecha = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    fecha.setUTCHours(0, 0, 0, 0);
    fin.setUTCHours(0, 0, 0, 0);

    while (fecha <= fin) {
        dias.push({ fecha: formatearFecha(fecha), lluvioso: null });
        fecha.setUTCDate(fecha.getUTCDate() + 1);
    }
    return dias;
};

const armarItinerario = (dias, lugares) => {
    const bajoTecho = lugares.filter((lugar) => TIPOS_BAJO_TECHO.includes(lugar.tipo));
    const aireLibre = lugares.filter((lugar) => !TIPOS_BAJO_TECHO.includes(lugar.tipo));

    dias.forEach((dia) => {
        dia.lugares = [];

        for (let i = 0; i < LUGARES_POR_DIA; i++) {
            let lugar;

            if (dia.lluvioso === true) {
                lugar = bajoTecho.shift() || aireLibre.shift();
            } else {
                lugar = aireLibre.shift() || bajoTecho.shift();
            }

            if (lugar) {
                lugar.fecha = dia.fecha;
                dia.lugares.push(lugar);
            }
        }
    });

    return dias;
};

const resumirItinerario = (itinerario) => {
    const partes = [];

    itinerario.forEach((dia) => {
        const nombres = dia.lugares.map((lugar) => lugar.nombre);
        partes.push(`${dia.fecha}: ${nombres.join(", ") || "sin plan puntual"}`);
    });

    return partes.join(" | ");
};

const pedirRecomendacionIA = async (prompt) => {
    try {
        const data = await askGroq(prompt);
        return extraerTexto(data) || null;
    } catch (error) {
        console.error("Error al pedir recomendación a Groq:", error.message);
        return null;
    }
};

const armarPlanDeViaje = async (viaje, diasHastaInicio) => {
    const coordenadas = await getCoordenadasOSM(viaje.destino);

    if (!coordenadas) {
        return null;
    }

    const fechaInicio = formatearFecha(viaje.fechaInicio);
    const fechaFin = formatearFecha(viaje.fechaFin);
    const dias = obtenerDiasDelViaje(viaje.fechaInicio, viaje.fechaFin);

    const puntos = await getPuntosDeInteres(coordenadas.latitude, coordenadas.longitude);
    const lugares = puntos.slice(0, dias.length * LUGARES_POR_DIA);

    let pronostico = null;
    let resumenHistorico = null;

    const diasHastaFin = calcularDiasHasta(viaje.fechaFin);

    if (diasHastaInicio >= 0 && diasHastaFin <= MAX_DIAS_PRONOSTICO) {
        try {
            pronostico = await getPronostico(
                coordenadas.latitude,
                coordenadas.longitude,
                fechaInicio,
                fechaFin,
            );
        } catch (error) {
            console.error("Error al pedir pronóstico a Open-Meteo:", error.message);
        }
    }

    if (pronostico) {
        dias.forEach((dia) => {
            const posicion = pronostico.time.indexOf(dia.fecha);

            if (posicion !== -1) {
                dia.lluvioso = pronostico.precipitation_sum[posicion] >= 1;
            }
        });
    } else {
        const historico = await getHistoricoPorAnios(
            coordenadas.latitude,
            coordenadas.longitude,
            fechaInicio,
            fechaFin,
        );
        resumenHistorico = resumirHistorico(historico);
    }

    const itinerario = armarItinerario(dias, lugares);

    let lugaresOrdenados = [];
    itinerario.forEach((dia) => {
        lugaresOrdenados = lugaresOrdenados.concat(dia.lugares);
    });

    const asignacion = resumirItinerario(itinerario);
    let prompt;

    if (pronostico) {
        prompt = `Sos un asistente de viajes. Este es el pronóstico diario para ${coordenadas.nombre} entre ${fechaInicio} y ${fechaFin} (temperaturas máx/mín en °C, precipitación en mm): ${JSON.stringify(pronostico)}. El viaje dura ${dias.length} días. Ya se repartieron estos lugares de interés reales entre los días del viaje: ${asignacion}. Escribí una recomendación breve (máximo 4 líneas, en español) explicando por qué ese reparto tiene sentido según el clima de cada día (aire libre si está despejado, bajo techo si llueve), mencionando la temperatura o condición que lo justifica. ${REGLAS_PROMPT}`;
    } else {
        prompt = `Sos un asistente de viajes. El viaje a ${coordenadas.nombre} empieza dentro de ${diasHastaInicio} días, muy lejos para un pronóstico exacto. Historial de los últimos ${resumenHistorico.aniosAnalizados} años para estas fechas: máxima promedio ${resumenHistorico.temperaturaMaximaPromedio}°C, mínima promedio ${resumenHistorico.temperaturaMinimaPromedio}°C, probabilidad histórica de lluvia ${resumenHistorico.probabilidadDeLluvia}%. El viaje dura ${dias.length} días. Ya se repartieron estos lugares de interés reales entre los días del viaje: ${asignacion}. Escribí una estimación breve del clima esperable (aclarando que es histórico, no exacto) y comentá brevemente por qué conviene ese reparto, en máximo 5 líneas y en español. ${REGLAS_PROMPT}`;
    }

    const recomendacion = await pedirRecomendacionIA(prompt);

    let recorrido = null;

    if (lugaresOrdenados.length > 1) {
        const ciudad = { latitude: coordenadas.latitude, longitude: coordenadas.longitude };
        const puntosRuta = [ciudad].concat(lugaresOrdenados);
        recorrido = await getRutaConParadas(puntosRuta);
    }

    const plan = {
        tipo: pronostico ? "pronostico" : "estimacion_historica",
        destino: coordenadas.nombre,
        destinoCoordenadas: {
            latitude: coordenadas.latitude,
            longitude: coordenadas.longitude,
        },
        recomendacion,
        lugaresDestacados: lugaresOrdenados,
        itinerarioPorDia: itinerario,
        recorrido,
    };

    if (pronostico) {
        plan.pronostico = pronostico;
    } else {
        plan.resumenHistorico = resumenHistorico;
    }

    return plan;
};

module.exports = {
    calcularDiasHasta,
    armarPlanDeViaje,
};