const { serveHTTP, addonBuilder } = require("stremio-addon-sdk");
const fs = require("fs");

// Leemos la base de datos congelada
const rawData = fs.readFileSync("datos.json", "utf8");
const cachedMovies = JSON.parse(rawData);

const PAGE_SIZE = 100;

const manifest = {
    id: "org.criterion.pro.max",
    version: "1.0.0",
    name: "Criterion Full (RD Ready)",
    description: "Colección Criterion completa con metadatos reales.",
    // AHORA LE DECIMOS A STREMIO QUE TENEMOS CATÁLOGO Y METADATOS
    resources: ["catalog", "meta"], 
    idPrefixes: ["tmdb:"], // Le avisamos que usamos IDs de TMDB
    types: ["movie"],
    catalogs: [
        { 
            type: "movie", 
            id: "criterion_cat", 
            name: "Criterion Collection",
            extra: [
                { name: "search" },
                { name: "skip" }
            ]
        }
    ]
};

const builder = new addonBuilder(manifest);

// 1. MANEJADOR DEL CATÁLOGO (La Vidriera)
builder.defineCatalogHandler(async ({ extra }) => {
    let results = cachedMovies;

    if (extra?.search) {
        const query = extra.search.toLowerCase();
        results = results.filter((m) => m.name.toLowerCase().includes(query));
    }

    const skip = parseInt(extra?.skip || "0", 10);
    results = results.slice(skip, skip + PAGE_SIZE);

    return { metas: results };
});

// 2. NUEVO: MANEJADOR DE METADATOS (La página de la película)
builder.defineMetaHandler(async ({ type, id }) => {
    // Buscamos la película exacta en nuestra memoria por su ID
    const movie = cachedMovies.find(m => m.id === id);
    
    if (movie) {
        return { meta: movie };
    } else {
        return { meta: {} };
    }
});

const PORT = process.env.PORT || 7005;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`🚀 Servidor ultrarrápido iniciado en el puerto ${PORT}`);
