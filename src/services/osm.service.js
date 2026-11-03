const axios = require("axios");

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const GEOAPIFY_ENDPOINT = "https://api.geoapify.com/v2/places";
const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";
const WIKIDATA_ENDPOINT = "https://www.wikidata.org/w/api.php";

const TIPOS_CIUDAD_VALIDOS = new Set(["city", "town", "village", "district", "county", "state"]);

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


const CATEGORIAS_TURISTICAS = [
    "entertainment.museum",
    "entertainment.culture",
    "heritage",
    "tourism.sights",
    "tourism.attraction",
    "leisure.park",
];

const PRIORIDAD = {
    "tourism.attraction": 0,
    "tourism.sights": 0,
    "heritage": 1,
    "entertainment.museum": 1,
    "entertainment.culture": 2,
    "leisure.park": 3,
};


const _wikidataId = (f) => {
    const p = f.properties;
    return p.wiki_and_media?.wikidata || p.datasource?.raw?.wikidata || null;
};

const _getDatosWikidata = async (ids) => {
    const datos = {};

    for (let i = 0; i < ids.length; i += 50) {
        const grupo = ids.slice(i, i + 50);

        try {
            const { data } = await axios.get(WIKIDATA_ENDPOINT, {
                params: {
                    action: "wbgetentities",
                    ids: grupo.join("|"),
                    props: "labels|sitelinks",
                    languages: "es",
                    format: "json"
                },
                headers: { "User-Agent": "PlanificadorViajesORT/1.0 (proyecto universitario)" },
                timeout: 15000
            });

            Object.entries(data.entities || {}).forEach(([id, entidad]) => {
                datos[id] = {
                    nombreEs: entidad.labels?.es?.value || null,
                    popularidad: Object.keys(entidad.sitelinks || {}).length
                };
            });
        } catch (error) {
            console.error("Error al consultar Wikidata:", error.message);
        }
    }

    return datos;
};

const _categoriaPrincipal = (categorias = []) => {
    const principal = CATEGORIAS_TURISTICAS.find((categoria) => categorias.includes(categoria));
    return principal || categorias[0] || "otro";
};

const _sinRepetidos = (features) => {
    const nombres = [];
    const ids = [];
    return features.filter((f) => {
        const id = _wikidataId(f);
        if (id && ids.includes(id)) {
            return false;
        }
        if (id) {
            ids.push(id);
        }

        const nombre = f.properties.name
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        const yaEsta = nombres.some((n) =>
            n === nombre ||
            (Math.min(n.length, nombre.length) >= 6 && (n.includes(nombre) || nombre.includes(n)))
        );
        if (yaEsta) {
            return false;
        }
        nombres.push(nombre);
        return true;
    });
};

const getPuntosDeInteres = async (latitude, longitude, radioMetros = 8000) => {
    try {
        const { data } = await axios.get(GEOAPIFY_ENDPOINT, {
            params: {
                categories: CATEGORIAS_TURISTICAS.join(","),
                filter: `circle:${longitude},${latitude},${radioMetros}`,
                bias: `proximity:${longitude},${latitude}`,
                limit: 500,
                apiKey: process.env.GEOAPIFY_API_KEY
            },
            timeout: 15000
        });

        if (!data || !Array.isArray(data.features)) {
            console.error("Respuesta inesperada de Geoapify (puntos de interés):", data);
            return [];
        }

        const conNombre = data.features.filter((f) => f.properties?.name);

        const lugares = _sinRepetidos(conNombre);
        const ids = lugares.map(_wikidataId).filter((id) => id !== null);
        const wiki = await _getDatosWikidata(ids);

        return lugares
            .map((f) => {
                const extra = wiki[_wikidataId(f)] || {};
                return {
                    nombre: extra.nombreEs || f.properties.datasource?.raw?.["name:es"] || f.properties.name,
                    tipo: _categoriaPrincipal(f.properties.categories),
                    popularidad: extra.popularidad || 0,
                    latitude: f.properties.lat,
                    longitude: f.properties.lon,
                    distanciaKm: f.properties.distance != null
                        ? Math.round(f.properties.distance / 100) / 10
                        : null
                };
            })
            .filter((l) => l.tipo !== "leisure.park" || l.popularidad > 0)
            .sort((a, b) =>
                (b.popularidad - a.popularidad) ||
                ((PRIORIDAD[a.tipo] ?? 4) - (PRIORIDAD[b.tipo] ?? 4)) ||
                ((a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity))
            );
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