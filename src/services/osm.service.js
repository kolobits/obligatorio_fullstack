const axios = require("axios");

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

const getCoordenadasOSM = async (lugar) => {
    const { data } = await axios.get(NOMINATIM_ENDPOINT, {
        params: { q: lugar, format: "json", limit: 1 },
        headers: { "User-Agent": "PlanificadorViajesORT/1.0 (proyecto universitario)" }
    });

    const resultado = data[0];

    if (!resultado) {
        return null;
    }

    return {
        latitude: parseFloat(resultado.lat),
        longitude: parseFloat(resultado.lon),
        nombre: resultado.display_name
    };
};

const _distanciaKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const x = (lon2 - lon1) * Math.PI / 180 * Math.cos((lat1 + lat2) * Math.PI / 360);
    const y = (lat2 - lat1) * Math.PI / 180;
    return R * Math.sqrt(x * x + y * y);
};

const TIPOS_ALOJAMIENTO = new Set([
    "hotel", "motel", "hostel", "guest_house", "apartment", "chalet",
    "camp_site", "caravan_site", "wilderness_hut", "alpine_hut"
]);

const TIPOS_DESTACADOS = new Set([
    "museum", "attraction", "gallery", "artwork", "viewpoint",
    "theme_park", "zoo", "aquarium"
]);

const _calcularImportancia = (tags) => {
    let score = 0;
    if (tags.wikipedia) score += 3;
    if (tags.wikidata) score += 2;
    if (tags.wikimedia_commons) score += 1;
    if (tags.website || tags["contact:website"]) score += 1;
    if (tags.image) score += 1;
    if (TIPOS_DESTACADOS.has(tags.tourism)) score += 1;
    return score;
};

const getPuntosDeInteres = async (latitude, longitude, radioMetros = 4000) => {
    const query = `
        [out:json][timeout:25];
        node["tourism"](around:${radioMetros},${latitude},${longitude});
        out body;
    `;

    try {
        const { data } = await axios.post(OVERPASS_ENDPOINT, query, {
            headers: {
                "Content-Type": "text/plain",
                "User-Agent": "PlanificadorViajesORT/1.0 (proyecto universitario)"
            },
            timeout: 15000
        });

        if (!data || !Array.isArray(data.elements)) {
            console.error(
                "Respuesta inesperada de Overpass (puntos de interés):",
                typeof data === "string" ? data.slice(0, 200) : data
            );
            return [];
        }

        return data.elements
            .filter((el) => el.tags?.name && !TIPOS_ALOJAMIENTO.has(el.tags.tourism))
            .map((el) => ({
                nombre: el.tags.name,
                tipo: el.tags.tourism,
                latitude: el.lat,
                longitude: el.lon,
                distanciaKm: Math.round(_distanciaKm(latitude, longitude, el.lat, el.lon) * 10) / 10,
                importancia: _calcularImportancia(el.tags),
                destacado: Boolean(el.tags.wikipedia || el.tags.wikidata)
            }))
            .sort((a, b) => b.importancia - a.importancia || a.distanciaKm - b.distanciaKm);
    } catch (error) {
        console.error(
            "Error al consultar Overpass (puntos de interés):",
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
