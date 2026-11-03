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

const GRUPOS_BUSQUEDA = [
    { categorias: "tourism.attraction", limite: 100 },
    { categorias: "tourism.sights", limite: 150 },
    { categorias: "entertainment.museum,entertainment.culture", limite: 100 },
    { categorias: "leisure.park", limite: 50 },
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
    const grupos = [];
    for (let i = 0; i < ids.length; i += 50) {
        grupos.push(ids.slice(i, i + 50));
    }

    const respuestas = await Promise.all(grupos.map(async (grupo) => {
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
            return data.entities || {};
        } catch (error) {
            console.error("Error al consultar Wikidata:", error.message);
            return {};
        }
    }));

    const datos = {};
    respuestas.forEach((entidades) => {
        Object.entries(entidades).forEach(([id, entidad]) => {
            datos[id] = {
                nombreEs: entidad.labels?.es?.value || null,
                popularidad: Object.keys(entidad.sitelinks || {}).length
            };
        });
    });

    return datos;
};

const _esMonumentoMenor = (categorias = []) =>
    !categorias.includes("tourism.attraction") &&
    categorias.some((c) => c.startsWith("tourism.sights.memorial"));

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

        const nombre = String(f.properties.name)
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

const _buscarGrupo = async (grupo, latitude, longitude, radioMetros) => {
    try {
        const { data } = await axios.get(GEOAPIFY_ENDPOINT, {
            params: {
                categories: grupo.categorias,
                filter: `circle:${longitude},${latitude},${radioMetros}`,
                bias: `proximity:${longitude},${latitude}`,
                limit: grupo.limite,
                apiKey: process.env.GEOAPIFY_API_KEY
            },
            timeout: 15000
        });
        return Array.isArray(data?.features) ? data.features : [];
    } catch (error) {
        console.error(
            `Error al consultar Geoapify (${grupo.categorias}):`,
            error?.response?.data || error.message
        );
        return [];
    }
};

const getPuntosDeInteres = async (latitude, longitude, radioMetros = 8000) => {
    try {
        const resultados = await Promise.all(
            GRUPOS_BUSQUEDA.map((grupo) => _buscarGrupo(grupo, latitude, longitude, radioMetros))
        );

        const conNombre = resultados.flat().filter((f) => f.properties?.name);

        const lugares = _sinRepetidos(conNombre);
        const ids = lugares.map(_wikidataId).filter((id) => id !== null);
        const wiki = await _getDatosWikidata(ids);

        return lugares
            .map((f) => {
                const extra = wiki[_wikidataId(f)] || {};
                const categorias = f.properties.categories || [];
                const popularidad = extra.popularidad || 0;
                return {
                    nombre: extra.nombreEs || f.properties.datasource?.raw?.["name:es"] || String(f.properties.name),
                    tipo: _categoriaPrincipal(categorias),
                    popularidad: _esMonumentoMenor(categorias) ? Math.round(popularidad / 4) : popularidad,
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
        console.error("Error al armar los puntos de interés:", error.message);
        return [];
    }
};

const getDistanciaEnLineaRecta = (origen, destino) => {
    const RADIO_TIERRA_KM = 6371;
    const aRadianes = (grados) => (grados * Math.PI) / 180;

    const dLat = aRadianes(destino.latitude - origen.latitude);
    const dLon = aRadianes(destino.longitude - origen.longitude);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(aRadianes(origen.latitude)) * Math.cos(aRadianes(destino.latitude)) * Math.sin(dLon / 2) ** 2;

    return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(a));
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
    getDistanciaEnLineaRecta,
    getCoordenadasOSM,
    getPuntosDeInteres,
    getRuta,
    getRutaConParadas,
};