const axios = require("axios");

const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

const getPronostico = async (latitude, longitude, fechaInicio, fechaFin) => {
    const { data } = await axios.get(FORECAST_ENDPOINT, {
        params: {
            latitude,
            longitude,
            daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode",
            timezone: "auto",
            start_date: fechaInicio,
            end_date: fechaFin
        }
    });

    return data.daily;
};

const ARCHIVE_ENDPOINT = "https://archive-api.open-meteo.com/v1/archive";

const getHistoricoPorAnios = async (latitude, longitude, fechaInicio, fechaFin, aniosAtras = 5) => {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    const pedidos = [];
    for (let i = 1; i <= aniosAtras; i++) {
        const inicioAnioPasado = new Date(inicio);
        inicioAnioPasado.setFullYear(inicio.getFullYear() - i);
        const finAnioPasado = new Date(fin);
        finAnioPasado.setFullYear(fin.getFullYear() - i);

        pedidos.push(
            axios.get(ARCHIVE_ENDPOINT, {
                params: {
                    latitude,
                    longitude,
                    start_date: inicioAnioPasado.toISOString().split("T")[0],
                    end_date: finAnioPasado.toISOString().split("T")[0],
                    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
                    timezone: "auto"
                }
            })
        );
    }

    const respuestas = await Promise.all(pedidos);
    return respuestas.map((r) => r.data.daily);
};

const resumirHistorico = (historico) => {
    const maxTemps = historico.flatMap((d) => d.temperature_2m_max);
    const minTemps = historico.flatMap((d) => d.temperature_2m_min);
    const precipitaciones = historico.flatMap((d) => d.precipitation_sum);

    const promedio = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const diasConLluvia = precipitaciones.filter((p) => p > 0).length;

    return {
        temperaturaMaximaPromedio: Math.round(promedio(maxTemps) * 10) / 10,
        temperaturaMinimaPromedio: Math.round(promedio(minTemps) * 10) / 10,
        probabilidadDeLluvia: Math.round((diasConLluvia / precipitaciones.length) * 100),
        aniosAnalizados: historico.length
    };
};

module.exports = { getPronostico, getHistoricoPorAnios, resumirHistorico };