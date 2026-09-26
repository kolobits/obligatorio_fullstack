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

const getPuntosDeInteres = async (latitude, longitude, radioMetros = 3000) => {
    const query = `
        [out:json][timeout:25];
        node["tourism"](around:${radioMetros},${latitude},${longitude});
        out body;
    `;

    const { data } = await axios.post(OVERPASS_ENDPOINT, query, {
        headers: {
            "Content-Type": "text/plain",
            "User-Agent": "PlanificadorViajesORT/1.0 (proyecto universitario)"
        }
    });

    return data.elements
        .filter((el) => el.tags?.name)
        .map((el) => ({
            nombre: el.tags.name,
            tipo: el.tags.tourism,
            latitude: el.lat,
            longitude: el.lon,
            distanciaKm: Math.round(_distanciaKm(latitude, longitude, el.lat, el.lon) * 10) / 10
        }))
        .sort((a, b) => a.distanciaKm - b.distanciaKm);
};

const getRuta = async (origen, destino) => {
    const coords = `${origen.longitude},${origen.latitude};${destino.longitude},${destino.latitude}`;

    const { data } = await axios.get(`${OSRM_ENDPOINT}/${coords}`, {
        params: { overview: "false" }
    });

    const ruta = data.routes?.[0];

    if (!ruta) {
        return null;
    }

    return {
        distanciaKm: Math.round(ruta.distance / 100) / 10,
        duracionHoras: Math.round((ruta.duration / 3600) * 10) / 10
    };
};

const getRutaConParadas = async (puntos) => {
    const coords = puntos.map((p) => `${p.longitude},${p.latitude}`).join(";");

    const { data } = await axios.get(`${OSRM_ENDPOINT}/${coords}`, {
        params: { overview: "full", geometries: "geojson" }
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
};

module.exports = { getCoordenadasOSM, getPuntosDeInteres, getRuta, getRutaConParadas };