const { serveHTTP, addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const fs = require("fs");

const TMDB_API_KEY = "e04516a65509f44ab8a88b456727f67b";
const CACHE_FILE = "./criterion_cache.json";
const PAGE_SIZE = 100;
const streamCache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
    return lines.slice(1).map(line => {
        const cols = [];
        let cur = "";
        let inQuotes = false;
        for (const ch of line) {
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === "," && !inQuotes) {
                cols.push(cur.trim());
                cur = "";
            } else {
                cur += ch;
            }
        }
        cols.push(cur.trim());
        return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]));
    });
}

// ─── Caché persistente ────────────────────────────────────────────────────────

function loadCache() {
    if (fs.existsSync(CACHE_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
            if (!Array.isArray(data) || data.length === 0) {
                console.log("⚠️  Caché vacía, regenerando...");
                return null;
            }
            console.log(`✅ Caché encontrada: ${data.length} películas. Inicio instantáneo.`);
            return data;
        } catch (e) {
            console.warn("⚠️  Caché corrupta, regenerando...");
        }
    }
    return null;
}

function saveCache(movies) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(movies), "utf8");
    console.log(`💾 Caché guardada en ${CACHE_FILE}`);
}

// ─── TMDB ─────────────────────────────────────────────────────────────────────

async function searchTMDB(title, year) {
    const params = new URLSearchParams({
        api_key: TMDB_API_KEY,
        query: title,
        ...(year ? { primary_release_year: year } : {}),
    });
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const search = await axios.get(`https://api.themoviedb.org/3/search/movie?${params}`);
            const result = search.data.results?.[0];
            if (!result) return null;

            const detail = await axios.get(
                `https://api.themoviedb.org/3/movie/${result.id}?api_key=${TMDB_API_KEY}`
            );
            return { ...result, imdb_id: detail.data.imdb_id };

        } catch (err) {
            if (err.response?.status === 429) {
                const retryAfter = (err.response.headers["retry-after"] ?? 10) * 1000;
                console.warn(`⏳ Rate limit. Esperando ${retryAfter / 1000}s...`);
                await sleep(retryAfter);
            } else {
                break;
            }
        }
    }
    return null;
}

// ─── Carga masiva ─────────────────────────────────────────────────────────────

let cachedMovies = [];
let isLoaded = false;

async function loadAllMovies() {
    const cached = loadCache();
    if (cached) {
        cachedMovies = cached;
        isLoaded = true;
        return;
    }

    console.log("--- INICIANDO CARGA MASIVA DE CRITERION ---");

    try {
        const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSaAmugSMHWkEaFaalaTj4V-7TirWA2pmRb30jqep-0B_YhH3qaa9Frzw3lZKlr6S98ZEfoHMFceezb/pub?output=csv";
        const res = await axios.get(url);
        const records = parseCSV(res.data);

        console.log(`📋 ${records.length} filas encontradas en el CSV.`);
        console.log(`⚠️  Esto tomará varios minutos.`);

        for (let i = 0; i < records.length; i++) {
            const row = records[i];
            const rawTitle = row["TITLE (Year)"]?.trim();
            const year = row["YEAR"]?.trim();
            const title = rawTitle?.replace(/\s*\(\d{4}\)$/, "").trim();

            if (!title) continue;

            const m = await searchTMDB(title, year);

            if (m && m.imdb_id) {
                cachedMovies.push({
                    id: m.imdb_id,
                    name: m.title,
                    poster: m.poster_path
                        ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
                        : null,
                    type: "movie",
                    description: m.overview,
                    releaseInfo: m.release_date?.slice(0, 4),
                    imdbRating: m.vote_average?.toFixed(1),
                });
            }

            if (i % 50 === 0) {
                console.log(`⏳ ${i}/${records.length} procesadas — ${cachedMovies.length} encontradas`);
            }

            await sleep(600);
        }

        isLoaded = true;
        console.log(`\n✅ Listo. ${cachedMovies.length} películas cargadas.`);
        saveCache(cachedMovies);

    } catch (e) {
        console.error("❌ Error crítico:", e.message);
    }
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

const manifest = {
    id: "org.criterion.pro.max",
    version: "1.0.0",
    name: "Criterion Collection",
    description: "Colección Criterion completa con streams vía Torrentio + RD.",
    resources: ["catalog", "stream"],
    types: ["movie"],
    catalogs: [
        {
            type: "movie",
            id: "criterion_cat",
            name: "Criterion Collection",
            extra: [
                { name: "search" },
                { name: "skip" },
            ],
        },
    ],
};

// ─── Builder ──────────────────────────────────────────────────────────────────

const builder = new addonBuilder(manifest);

// ─── Catalog handler ──────────────────────────────────────────────────────────

builder.defineCatalogHandler(async ({ extra }) => {
    if (!isLoaded) {
        return {
            metas: [{
                id: "tt0000001",
                type: "movie",
                name: "⏳ Sincronizando con TMDB — volvé en unos minutos",
                poster: "https://via.placeholder.com/300x450?text=Cargando...",
            }],
        };
    }

    let results = cachedMovies;

    if (extra?.search) {
        const q = extra.search.toLowerCase();
        results = results.filter((m) => m.name.toLowerCase().includes(q));
    }

    const skip = parseInt(extra?.skip ?? "0", 10);
    results = results.slice(skip, skip + PAGE_SIZE);

    return { metas: results };
});

// ─── Stream handler ───────────────────────────────────────────────────────────

builder.defineStreamHandler(async ({ id }) => {
    if (!id.startsWith("tt")) return { streams: [] };

    if (streamCache.has(id)) {
        console.log(`📦 Stream desde caché: ${id}`);
        return { streams: streamCache.get(id) };
    }

    console.log(`🔍 Buscando streams para: ${id}`);

    try {
        const rdToken = process.env.RD_TOKEN;
        const url = rdToken
            ? `https://torrentio.strem.fun/realdebrid=${rdToken}/stream/movie/${id}.json`
            : `https://torrentio.strem.fun/stream/movie/${id}.json`;

        const res = await axios.get(url, { timeout: 10000 });
        const streams = res.data.streams ?? [];

        streamCache.set(id, streams);
        console.log(`✅ ${streams.length} streams encontrados para ${id}`);
        return { streams };

    } catch (e) {
        console.error(`❌ Error buscando streams para ${id}:`, e.message);
        return { streams: [] };
    }
});

// ─── Arranque ─────────────────────────────────────────────────────────────────

loadAllMovies();
serveHTTP(builder.getInterface(), { port: 7005 });
console.log("🚀 Servidor en: http://127.0.0.1:7005/manifest.json");
