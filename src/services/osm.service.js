const axios = require("axios");

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const GEOAPIFY_ENDPOINT = "https://api.geoapify.com/v2/places";
const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";
const WIKIDATA_ENDPOINT = "https://www.wikidata.org/w/api.php";
const WIKIDATA_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "PlanificadorViajesORT/1.0 (proyecto universitario)";

const TIPOS_CIUDAD_VALIDOS = new Set(["city", "town", "village", "district", "county", "state"]);

const getCoordenadasOSM = async (lugar) => {
    const { data } = await axios.get(NOMINATIM_ENDPOINT, {
        params: { q: lugar, format: "geocodejson", limit: 1 },
        headers: { "User-Agent": USER_AGENT }
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
                headers: { "User-Agent": USER_AGENT },
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

const _normalizar = (texto) => String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const _sinRepetidos = (lugares) => {
    const nombres = [];
    const ids = [];
    return lugares.filter((lugar) => {
        if (lugar.wikidata && ids.includes(lugar.wikidata)) {
            return false;
        }
        const nombre = _normalizar(lugar.nombre);
        const yaEsta = nombres.some((n) =>
            n === nombre ||
            (Math.min(n.length, nombre.length) >= 6 && (n.includes(nombre) || nombre.includes(n)))
        );
        if (yaEsta) {
            return false;
        }
        if (lugar.wikidata) {
            ids.push(lugar.wikidata);
        }
        nombres.push(nombre);
        return true;
    });
};

const _sinSuperpuestos = (lugares) => {
    const elegidos = [];
    lugares.forEach((lugar) => {
        const cercaDe = (km) => elegidos.some((e) => getDistanciaEnLineaRecta(e, lugar) <= km);
        if (cercaDe(0.03)) {
            return;
        }
        if (lugar.clase === "montaña" && cercaDe(0.5)) {
            return;
        }
        if (lugar.clase === "estadio" && elegidos.some((e) => e.clase === "estadio")) {
            return;
        }
        elegidos.push(lugar);
    });
    return elegidos;
};

const RADIO_FAMOSOS_KM = 12;
const MINIMO_WIKIPEDIAS = 5;

const RAICES_WIKIDATA = [
    { id: "Q33506", nombre: "museo", tipo: "entertainment.museum" },
    { id: "Q16560", nombre: "palacio", tipo: "entertainment.museum" },
    { id: "Q24354", nombre: "teatro", tipo: "entertainment.culture" },
    { id: "Q16970", nombre: "iglesia", tipo: "entertainment.culture" },
    { id: "Q570116", nombre: "atracción turística", tipo: "tourism.attraction" },
    { id: "Q179700", nombre: "estatua", tipo: "tourism.sights" },
    { id: "Q8502", nombre: "montaña", tipo: "tourism.attraction" },
    { id: "Q40080", nombre: "playa", tipo: "tourism.attraction" },
    { id: "Q483110", nombre: "estadio", tipo: "tourism.attraction" },
    { id: "Q174782", nombre: "plaza", tipo: "tourism.sights" },
    { id: "Q22698", nombre: "parque", tipo: "leisure.park" },
];

const TIPOS_BAJO_TECHO = ["entertainment.museum", "entertainment.culture"];

const _consultaFamosos = (latitude, longitude) => `
SELECT ?item ?itemLabel ?coord ?links ?raiz WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${longitude} ${latitude})"^^geo:wktLiteral ;
                    wikibase:radius "${RADIO_FAMOSOS_KM}" .
  }
  ?item wikibase:sitelinks ?links .
  FILTER(?links >= ${MINIMO_WIKIPEDIAS})
  VALUES ?raiz { ${RAICES_WIKIDATA.map((r) => `wd:${r.id}`).join(" ")} }
  ?item wdt:P31/wdt:P279* ?raiz .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,mul,en". }
}
ORDER BY DESC(?links)
LIMIT 300`;

const _getLugaresFamosos = async (latitude, longitude) => {
    try {
        const { data } = await axios.get(WIKIDATA_SPARQL_ENDPOINT, {
            params: { query: _consultaFamosos(latitude, longitude), format: "json" },
            headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" },
            timeout: 12000
        });

        const porId = {};

        data.results.bindings.forEach((fila) => {
            const id = fila.item.value.split("/").pop();
            const nombre = fila.itemLabel?.value;
            if (!nombre || nombre === id) {
                return;
            }

            const raiz = RAICES_WIKIDATA.find((r) => r.id === fila.raiz.value.split("/").pop());
            const [lon, lat] = fila.coord.value.replace("Point(", "").replace(")", "").split(" ").map(Number);

            if (!porId[id]) {
                porId[id] = {
                    nombre,
                    tipo: raiz.tipo,
                    popularidad: Number(fila.links.value),
                    wikidata: id,
                    clase: raiz.nombre,
                    latitude: lat,
                    longitude: lon,
                    distanciaKm: Math.round(getDistanciaEnLineaRecta({ latitude, longitude }, { latitude: lat, longitude: lon }) * 10) / 10
                };
            } else if (TIPOS_BAJO_TECHO.includes(raiz.tipo)) {
                porId[id].tipo = raiz.tipo;
            }
        });

        return Object.values(porId);
    } catch (error) {
        console.error("Error al consultar lugares famosos en Wikidata:", error.message);
        return [];
    }
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
        const [famosos, resultados] = await Promise.all([
            _getLugaresFamosos(latitude, longitude),
            Promise.all(GRUPOS_BUSQUEDA.map((grupo) => _buscarGrupo(grupo, latitude, longitude, radioMetros)))
        ]);

        const features = resultados.flat().filter((f) => f.properties?.name);
        const ids = features.map(_wikidataId).filter((id) => id !== null);
        const wiki = await _getDatosWikidata([...new Set(ids)]);

        const deGeoapify = features.map((f) => {
            const id = _wikidataId(f);
            const extra = wiki[id] || {};
            const categorias = f.properties.categories || [];
            const popularidad = extra.popularidad || 0;
            return {
                nombre: extra.nombreEs || f.properties.datasource?.raw?.["name:es"] || String(f.properties.name),
                tipo: _categoriaPrincipal(categorias),
                popularidad: _esMonumentoMenor(categorias) ? Math.round(popularidad / 4) : popularidad,
                wikidata: id,
                latitude: f.properties.lat,
                longitude: f.properties.lon,
                distanciaKm: f.properties.distance != null
                    ? Math.round(f.properties.distance / 100) / 10
                    : null
            };
        });

        const ordenados = famosos.concat(deGeoapify).sort((a, b) =>
            (b.popularidad - a.popularidad) ||
            ((PRIORIDAD[a.tipo] ?? 4) - (PRIORIDAD[b.tipo] ?? 4)) ||
            ((a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity))
        );

        return _sinSuperpuestos(_sinRepetidos(ordenados))
            .filter((l) => l.tipo !== "leisure.park" || l.popularidad > 0);
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