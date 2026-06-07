const { serveHTTP, addonBuilder } = require("stremio-addon-sdk");
const fs = require("fs");

// Leemos la base de datos congelada
const rawData = fs.readFileSync("datos.json", "utf8");
const cachedMovies = JSON.parse(rawData);

// Le decimos a Stremio que vamos a enviar las películas de a 100
const PAGE_SIZE = 100;

const manifest = {
    id: "org.criterion.pro.max",
    version: "1.0.0",
    name: "Criterion Full (RD Ready)",
    description: "Colección Criterion completa con metadatos reales.",
    resources: ["catalog"],
    types: ["movie"],
    catalogs: [
        { 
            type: "movie", 
            id: "criterion_cat", 
            name: "Criterion Collection",
            // ESTO ES LA MAGIA: Le activamos la búsqueda y el "scroll" (skip)
            extra: [
                { name: "search" },
                { name: "skip" }
            ]
        }
    ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ extra }) => {
    let results = cachedMovies;

    // 1. Si el usuario escribe en el buscador de Stremio
    if (extra?.search) {
        const query = extra.search.toLowerCase();
        results = results.filter((m) => m.name.toLowerCase().includes(query));
    }

    // 2. Si el usuario hace scroll hacia abajo (Paginación)
    const skip = parseInt(extra?.skip || "0", 10);
    results = results.slice(skip, skip + PAGE_SIZE);

    return { metas: results };
});

const PORT = process.env.PORT || 7005;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`🚀 Servidor ultrarrápido iniciado en el puerto ${PORT}`);
