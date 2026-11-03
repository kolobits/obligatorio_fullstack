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
const LUGARES_POR_DIA = 3;
const CANDIDATOS_CERCANOS = 12;
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

const distanciaEntre = (a, b) => {
    const dLat = a.latitude - b.latitude;
    const dLon = (a.longitude - b.longitude) * Math.cos((a.latitude * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLon * dLon) * 111;
};

const armarItinerario = (dias, lugares) => {
    const usados = [];
    const esBajoTecho = (lugar) => TIPOS_BAJO_TECHO.includes(lugar.tipo);
    const esAireLibre = (lugar) => !esBajoTecho(lugar);
    const cualquiera = () => true;

    const disponibles = (condicion) => lugares.filter((l) => !usados.includes(l) && condicion(l));

    const tomar = (condicion) => {
        const lugar = disponibles(condicion)[0];
        if (lugar) {
            usados.push(lugar);
        }
        return lugar;
    };

    const tomarCercano = (ancla, condicion) => {
        const candidatos = disponibles(condicion).slice(0, CANDIDATOS_CERCANOS);
        if (candidatos.length === 0) {
            return undefined;
        }
        let lugar = candidatos[0];
        candidatos.forEach((c) => {
            if (distanciaEntre(ancla, c) < distanciaEntre(ancla, lugar)) {
                lugar = c;
            }
        });
        usados.push(lugar);
        return lugar;
    };

    const completarDia = (dia, ancla, condicion) => {
        dia.lugares = [];
        if (!ancla) {
            return;
        }
        dia.lugares.push({ ...ancla, fecha: dia.fecha });
        for (let i = 1; i < LUGARES_POR_DIA; i++) {
            const lugar = tomarCercano(ancla, condicion) || tomarCercano(ancla, cualquiera);
            if (lugar) {
                dia.lugares.push({ ...lugar, fecha: dia.fecha });
            }
        }
    };

    dias.forEach((dia) => {
        dia.lugares = [];
    });

    dias.filter((dia) => dia.lluvioso === true).forEach((dia) => {
        completarDia(dia, tomar(esBajoTecho) || tomar(cualquiera), esBajoTecho);
    });

    dias.filter((dia) => dia.lluvioso !== true).forEach((dia) => {
        completarDia(dia, tomar(esAireLibre) || tomar(cualquiera), cualquiera);
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

    if (diasHastaFin >= 0 && diasHastaFin <= MAX_DIAS_PRONOSTICO) {
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
        prompt = `Sos un asistente de viajes. Escribile al viajero una recomendación para su viaje de ${dias.length} días a ${coordenadas.nombre}. ${diasHastaInicio > 0 ? `Faltan ${diasHastaInicio} días` : "El viaje ya empezó pero dura más de lo que cubre el pronóstico"}, así que no hay pronóstico exacto: solo el promedio de los últimos ${resumenHistorico.aniosAnalizados} años para esas fechas (máxima ${Math.round(resumenHistorico.temperaturaMaximaPromedio)}°, mínima ${Math.round(resumenHistorico.temperaturaMinimaPromedio)}°, llueve el ${resumenHistorico.probabilidadDeLluvia}% de los días).

Plan día por día (ya está decidido):
${asignacion}

Contale qué clima suele hacer en esa época (aclarando que es un promedio, no un pronóstico) y qué conviene tener en cuenta. Si la probabilidad de lluvia es alta, recordale que los lugares bajo techo le sirven de plan B.

${REGLAS_PROMPT}`;
    }

    const recomendacion = await pedirRecomendacionIA(prompt);

    for (const dia of itinerario) {
        dia.recorrido = dia.lugares.length > 1 ? await getRutaConParadas(dia.lugares) : null;
    }

    let recorrido = null;
    const diasConRuta = itinerario.filter((dia) => dia.recorrido);

    if (diasConRuta.length > 0) {
        let distanciaKm = 0;
        let duracionHoras = 0;
        diasConRuta.forEach((dia) => {
            distanciaKm += dia.recorrido.distanciaKm;
            duracionHoras += dia.recorrido.duracionHoras;
        });
        recorrido = {
            distanciaKm: Math.round(distanciaKm * 10) / 10,
            duracionHoras: Math.round(duracionHoras * 10) / 10
        };
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