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

// Categorías que le pedimos a Geoapify, de la más importante a la menos importante
// (ver https://apidocs.geoapify.com/docs/places/)
const CATEGORIAS_TURISTICAS = [
    "entertainment.museum",
    "entertainment.culture",
    "heritage",
    "tourism.sights",
    "tourism.attraction",
    "leisure.park",
];

// Cada lugar trae todas sus categorías (ej: ["entertainment", "entertainment.museum"]).
// Nos quedamos con la primera de nuestra lista que tenga.
const _categoriaPrincipal = (categorias = []) => {
    const principal = CATEGORIAS_TURISTICAS.find((categoria) => categorias.includes(categoria));
    return principal || categorias[0] || "otro";
};

// OpenStreetMap a veces tiene el mismo lugar cargado dos veces con el mismo nombre
const _sinRepetidos = (features) => {
    const nombres = [];
    return features.filter((f) => {
        // En minúscula y sin tildes: "Simón Bolívar" y "Simon Bolivar" son el mismo
        const nombre = f.properties.name
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        if (nombres.includes(nombre)) {
            return false;
        }
        nombres.push(nombre);
        return true;
    });
};

const getPuntosDeInteres = async (latitude, longitude, radioMetros = 4000) => {
    try {
        const { data } = await axios.get(GEOAPIFY_ENDPOINT, {
            params: {
                categories: CATEGORIAS_TURISTICAS.join(","),
                filter: `circle:${longitude},${latitude},${radioMetros}`,
                bias: `proximity:${longitude},${latitude}`,
                limit: 40,
                apiKey: process.env.GEOAPIFY_API_KEY
            },
            timeout: 15000
        });

        if (!data || !Array.isArray(data.features)) {
            console.error("Respuesta inesperada de Geoapify (puntos de interés):", data);
            return [];
        }

        const conNombre = data.features.filter((f) => f.properties?.name);

        return _sinRepetidos(conNombre)
            .map((f) => ({
                nombre: f.properties.name,
                tipo: _categoriaPrincipal(f.properties.categories),
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

module.exports = {
    CATEGORIAS_TURISTICAS,
    getCoordenadasOSM,
    getPuntosDeInteres,
    getRuta,
    getRutaConParadas,
};