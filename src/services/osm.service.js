const axios = require("axios");

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const GEOAPIFY_ENDPOINT = "https://api.geoapify.com/v2/places";
const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

const TIPOS_CIUDAD_VALIDOS = new Set(["city"]);

const getCoordenadasOSM = async (lugar) => {
    const { data } = await axios.get(NOMINATIM_ENDPOINT, {
        params: { q: lugar, format: "geocodejson", limit: 1 },
        headers: { "User-Agent": "PlanificadorViajesORT/1.0 (proyecto universitario)" }
    });

    const resultado = data.features?.[0];

    if (!resultado) {
        return null;
    }

    const tipo = resultado.properties.geocoding.type;

    if (!TIPOS_CIUDAD_VALIDOS.has(tipo)) {
        console.error(`"${lugar}" se geocodificó como "${tipo}", no como ciudad. Se rechaza.`);
        return null;
    }

    const [longitude, latitude] = resultado.geometry.coordinates;

    return {
        latitude,
        longitude,
        nombre: resultado.properties.geocoding.label
    };
};

// const GEOAPIFY_CATEGORIAS = "heritage,entertainment,leisure.park";
const GEOAPIFY_CATEGORIAS = "tourism.attraction"

const getPuntosDeInteres = async (latitude, longitude, radioMetros = 4000) => {
    try {
        const { data } = await axios.get(GEOAPIFY_ENDPOINT, {
            params: {
                categories: GEOAPIFY_CATEGORIAS,
                filter: `circle:${longitude},${latitude},${radioMetros}`,
                bias: `proximity:${longitude},${latitude}`,
                limit: 20,
                apiKey: process.env.GEOAPIFY_API_KEY
            },
            timeout: 15000
        });

        if (!data || !Array.isArray(data.features)) {
            console.error("Respuesta inesperada de Geoapify (puntos de interés):", data);
            return [];
        }

        return data.features
            .filter((f) => f.properties?.name)
            .map((f) => ({
                nombre: f.properties.name,
                tipo: f.properties.categories?.[0] || "otro",
                latitude: f.properties.lat,
                longitude: f.properties.lon,
                distanciaKm: f.properties.distance != null
                    ? Math.round(f.properties.distance / 100) / 10
                    : null
            }))
            .sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
    } catch (error) {
        console.error(
            "Error al consultar Geoapify (puntos de interés):",
            error?.response?.data || error.message
        );
        return [];
    }
};

const getRuta = async (origen, destino) => {
    const coords = `${origen.longitude},${origen.latitude};${destino.longitude},${destino.latitude}`;

    try {
        const { data } = await axios.get(`${OSRM_ENDPOINT}/${coords}`, {
            params: { overview: "false" },
            timeout: 15000
        });

        const ruta = data.routes?.[0];

        if (!ruta) {
            return null;
        }

        return {
            distanciaKm: Math.round(ruta.distance / 100) / 10,
            duracionHoras: Math.round((ruta.duration / 3600) * 10) / 10
        };
    } catch (error) {
        console.error(
            "Error al consultar OSRM (ruta):",
            error?.response?.data || error.message
        );
        return null;
    }
};

const getRutaConParadas = async (puntos) => {
    const coords = puntos.map((p) => `${p.longitude},${p.latitude}`).join(";");

    try {
        const { data } = await axios.get(`${OSRM_ENDPOINT}/${coords}`, {
            params: { overview: "full", geometries: "geojson" },
            timeout: 15000
        });

        const ruta = data.routes?.[0];

        if (!ruta) {
            return null;
        }

        return {
            distanciaKm: Math.round(ruta.distance / 100) / 10,
            duracionHoras: Math.round((ruta.duration / 3600) * 10) / 10,
            coordenadas: ruta.geometry.coordinates
        };
    } catch (error) {
        console.error(
            "Error al consultar OSRM (ruta con paradas):",
            error?.response?.data || error.message
        );
        return null;
    }
};

module.exports = { getCoordenadasOSM, getPuntosDeInteres, getRuta, getRutaConParadas };