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

const REGLAS_PROMPT = `Reglas:
- Español rioplatense (usá "vos"), tono cálido y cercano, como un amigo que conoce la ciudad.
- Un solo párrafo de 2 o 3 oraciones, máximo 60 palabras.
- Nombrá los días como "el día 1", "el día 2"; nunca por la fecha.
- Temperaturas redondeadas, sin decimales. No menciones milímetros ni códigos de clima.
- No cambies el reparto, no inventes lugares y no los describas.
- Un lugar "al aire libre" nunca es bajo techo.
- Texto plano, sin markdown, sin saludo ni despedida.`;

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


const describirClima = (codigo) => {
    if (codigo === 0) return "despejado";
    if (codigo <= 3) return "parcialmente nublado";
    if (codigo <= 48) return "con niebla";
    if (codigo <= 57) return "con llovizna";
    if (codigo <= 67 || (codigo >= 80 && codigo <= 82)) return "con lluvia";
    if (codigo <= 77 || codigo === 85 || codigo === 86) return "con nieve";
    return "con tormenta";
};

const resumirItinerario = (itinerario, pronostico) => {
    const lineas = itinerario.map((dia, i) => {
        const nombreDia = new Date(dia.fecha).toLocaleDateString("es-UY", { weekday: "long", timeZone: "UTC" });
        let clima = "";

        if (pronostico) {
            const posicion = pronostico.time.indexOf(dia.fecha);
            if (posicion !== -1) {
                const max = Math.round(pronostico.temperature_2m_max[posicion]);
                const min = Math.round(pronostico.temperature_2m_min[posicion]);
                const estado = dia.lluvioso ? "día de lluvia" : describirClima(pronostico.weathercode[posicion]);
                clima = `${estado}, máxima ${max}° y mínima ${min}°. `;
            }
        }

        const lugares = dia.lugares.map((lugar) => {
            const donde = TIPOS_BAJO_TECHO.includes(lugar.tipo) ? "bajo techo" : "al aire libre";
            return `${lugar.nombre} (${donde})`;
        });

        return `Día ${i + 1} (${nombreDia}): ${clima}Lugares: ${lugares.join(", ") || "día libre"}.`;
    });

    return lineas.join("\n");
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

    const itinerario = armarItinerario(dias, puntos);

    let lugaresOrdenados = [];
    itinerario.forEach((dia) => {
        lugaresOrdenados = lugaresOrdenados.concat(dia.lugares);
    });

    const asignacion = resumirItinerario(itinerario, pronostico);
    let prompt;

    if (pronostico) {
        prompt = `Sos un asistente de viajes. Escribile al viajero una recomendación para su viaje de ${dias.length} días a ${coordenadas.nombre}.

Plan día por día (ya está decidido):
${asignacion}

Contale cómo viene el clima en general y destacá uno o dos días puntuales. Si hay días de lluvia, explicá que quedaron para lugares bajo techo; si no hay, no hables de lluvia.

${REGLAS_PROMPT}`;
    } else {
        prompt = `Sos un asistente de viajes. Escribile al viajero una recomendación para su viaje de ${dias.length} días a ${coordenadas.nombre}. Faltan ${diasHastaInicio} días, así que todavía no hay pronóstico: solo el promedio de los últimos ${resumenHistorico.aniosAnalizados} años para esas fechas (máxima ${Math.round(resumenHistorico.temperaturaMaximaPromedio)}°, mínima ${Math.round(resumenHistorico.temperaturaMinimaPromedio)}°, llueve el ${resumenHistorico.probabilidadDeLluvia}% de los días).

Plan día por día (ya está decidido):
${asignacion}

Contale qué clima suele hacer en esa época (aclarando que es un promedio, no un pronóstico) y qué conviene tener en cuenta. Si la probabilidad de lluvia es alta, recordale que los lugares bajo techo le sirven de plan B.

${REGLAS_PROMPT}`;
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