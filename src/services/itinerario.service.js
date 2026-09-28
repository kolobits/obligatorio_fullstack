const {
    CATEGORIAS_TURISTICAS,
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


const calcularDiasHasta = (fecha) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.ceil((fecha - hoy) / MS_POR_DIA);
};

const _formatearFecha = (fecha) => fecha.toISOString().split("T")[0];


const _diasDelViaje = (fechaInicio, fechaFin) => {
    const dias = [];
    const cursor = new Date(fechaInicio);
    cursor.setUTCHours(0, 0, 0, 0);
    const fin = new Date(fechaFin);
    fin.setUTCHours(0, 0, 0, 0);

    while (cursor <= fin) {
        dias.push({ fecha: _formatearFecha(cursor), lluvioso: null });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dias;
};


const _prioridad = (lugar) => {
    const posicion = CATEGORIAS_TURISTICAS.indexOf(lugar.tipo);
    return posicion === -1 ? CATEGORIAS_TURISTICAS.length : posicion;
};


const _seleccionarLugares = (puntos, cantidadDias) => {
    const cantidad = cantidadDias * LUGARES_POR_DIA;
    const maxPorTipo = Math.ceil(cantidadDias / 2);

    const ordenados = [...puntos].sort((a, b) => {
        if (_prioridad(a) !== _prioridad(b)) {
            return _prioridad(a) - _prioridad(b);
        }
        return a.distanciaKm - b.distanciaKm;
    });

    const seleccion = [];
    const usadosPorTipo = {};
    ordenados.forEach((lugar) => {
        const usados = usadosPorTipo[lugar.tipo] || 0;
        if (seleccion.length < cantidad && usados < maxPorTipo) {
            seleccion.push(lugar);
            usadosPorTipo[lugar.tipo] = usados + 1;
        }
    });

    return seleccion;
};

const _esBajoTecho = (lugar) => TIPOS_BAJO_TECHO.includes(lugar.tipo);


const _elegirLugarParaDia = (dia, pendientes) => {
    let posicion = -1;

    if (dia.lluvioso === true) {
        posicion = pendientes.findIndex((lugar) => _esBajoTecho(lugar));
    }
    if (dia.lluvioso === false) {
        posicion = pendientes.findIndex((lugar) => !_esBajoTecho(lugar));
    }

    return posicion === -1 ? 0 : posicion;
};

const _armarItinerarioPorDia = (dias, lugares) => {
    const itinerario = dias.map((dia) => ({ ...dia, lugares: [] }));

    if (itinerario.length === 0) {
        return itinerario;
    }

    const pendientes = [...lugares];
    let vuelta = 0;

    while (pendientes.length > 0) {
        const dia = itinerario[vuelta % itinerario.length];
        const posicion = _elegirLugarParaDia(dia, pendientes);
        const lugar = pendientes.splice(posicion, 1)[0];

        dia.lugares.push({ ...lugar, fecha: dia.fecha });
        vuelta++;
    }

    return itinerario;
};

const _lugaresEnOrden = (itinerarioPorDia) => {
    const lugares = [];
    itinerarioPorDia.forEach((dia) => {
        lugares.push(...dia.lugares);
    });
    return lugares;
};

const _resumirAsignacion = (itinerarioPorDia) => {
    return itinerarioPorDia
        .map((dia) => {
            const nombres = dia.lugares.map((lugar) => lugar.nombre).join(", ");
            return `${dia.fecha}: ${nombres || "sin plan puntual"}`;
        })
        .join(" | ");
};

const _pedirRecomendacionIA = async (prompt) => {
    try {
        const data = await askGroq(prompt);
        return extraerTexto(data);
    } catch (error) {
        console.error(
            "Error al pedir recomendación a Groq:",
            error?.response?.data || error.message,
        );
        return null;
    }
};

const _armarRecorrido = async (coordenadas, lugares) => {
    if (lugares.length <= 1) {
        return null;
    }

    const puntosRuta = [
        { latitude: coordenadas.latitude, longitude: coordenadas.longitude },
        ...lugares,
    ];
    return await getRutaConParadas(puntosRuta);
};

const _planConPronostico = async (datos, pronostico) => {
    const { coordenadas, diasDelViaje, lugaresDestacados, fechaInicio, fechaFin } = datos;

    const dias = diasDelViaje.map((dia) => {
        const posicion = pronostico.time.indexOf(dia.fecha);
        return {
            ...dia,
            lluvioso: posicion !== -1 ? pronostico.precipitation_sum[posicion] >= 1 : null,
        };
    });

    const itinerarioPorDia = _armarItinerarioPorDia(dias, lugaresDestacados);
    const lugaresOrdenados = _lugaresEnOrden(itinerarioPorDia);

    const prompt = `Sos un asistente de viajes. Este es el pronóstico diario para ${coordenadas.nombre} entre ${fechaInicio} y ${fechaFin} (temperaturas máx/mín en °C, precipitación en mm): ${JSON.stringify(pronostico)}. Ya se repartieron estos lugares de interés reales entre los días del viaje: ${_resumirAsignacion(itinerarioPorDia)}. El viaje dura ${diasDelViaje.length} días. Escribí una recomendación breve (máximo 4 líneas, en español) explicando por qué ese reparto tiene sentido según el clima de cada día (aire libre si está despejado, bajo techo si llueve), mencionando la temperatura o condición que lo justifica. No cambies el reparto, no inventes otros lugares y no describas los lugares. Respondé en texto plano, sin markdown.`;
    const recomendacion = await _pedirRecomendacionIA(prompt);
    const recorrido = await _armarRecorrido(coordenadas, lugaresOrdenados);

    return {
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
    };
};

const _planConHistorico = async (datos, diasHastaInicio) => {
    const { coordenadas, diasDelViaje, lugaresDestacados, fechaInicio, fechaFin } = datos;

    const historico = await getHistoricoPorAnios(
        coordenadas.latitude,
        coordenadas.longitude,
        fechaInicio,
        fechaFin,
    );
    const resumen = resumirHistorico(historico);

    const itinerarioPorDia = _armarItinerarioPorDia(diasDelViaje, lugaresDestacados);
    const lugaresOrdenados = _lugaresEnOrden(itinerarioPorDia);

    const prompt = `Sos un asistente de viajes. El viaje a ${coordenadas.nombre} dura ${diasDelViaje.length} días y empieza dentro de ${diasHastaInicio} días, muy lejos para un pronóstico exacto. Historial de los últimos ${resumen.aniosAnalizados} años para estas fechas: máxima promedio ${resumen.temperaturaMaximaPromedio}°C, mínima promedio ${resumen.temperaturaMinimaPromedio}°C, probabilidad histórica de lluvia ${resumen.probabilidadDeLluvia}%. Ya se repartieron estos lugares de interés reales entre los días del viaje: ${_resumirAsignacion(itinerarioPorDia)}. Escribí una estimación breve del clima esperable (aclarando que es histórico, no exacto) y comentá brevemente por qué conviene ese reparto, en máximo 5 líneas y en español. No cambies el reparto, no inventes otros lugares y no describas los lugares. Respondé en texto plano, sin markdown.`;
    const recomendacion = await _pedirRecomendacionIA(prompt);
    const recorrido = await _armarRecorrido(coordenadas, lugaresOrdenados);

    return {
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
    };
};

const armarPlanDeViaje = async (viaje, diasHastaInicio) => {
    const coordenadas = await getCoordenadasOSM(viaje.destino);

    if (!coordenadas) {
        return null;
    }

    const diasDelViaje = _diasDelViaje(viaje.fechaInicio, viaje.fechaFin);

    const puntos = await getPuntosDeInteres(coordenadas.latitude, coordenadas.longitude);
    const lugaresDestacados = _seleccionarLugares(puntos, diasDelViaje.length);

    const datos = {
        coordenadas,
        diasDelViaje,
        lugaresDestacados,
        fechaInicio: _formatearFecha(viaje.fechaInicio),
        fechaFin: _formatearFecha(viaje.fechaFin),
    };

    const diasHastaFin = calcularDiasHasta(viaje.fechaFin);
    const puedeUsarPronostico = diasHastaInicio >= 0 && diasHastaFin <= MAX_DIAS_PRONOSTICO;

    let pronostico = null;
    if (puedeUsarPronostico) {
        try {
            pronostico = await getPronostico(
                coordenadas.latitude,
                coordenadas.longitude,
                datos.fechaInicio,
                datos.fechaFin,
            );
        } catch (error) {
            console.error(
                "Error al pedir pronóstico a Open-Meteo:",
                error?.response?.data || error.message,
            );
        }
    }

    if (pronostico) {
        return await _planConPronostico(datos, pronostico);
    }
    return await _planConHistorico(datos, diasHastaInicio);
};

module.exports = {
    calcularDiasHasta,
    armarPlanDeViaje,
};