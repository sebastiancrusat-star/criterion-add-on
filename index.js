const { serveHTTP, addonBuilder } = require("stremio-addon-sdk");
const fs = require("fs");

const rawData = fs.readFileSync("datos.json", "utf8");
const cachedMovies = JSON.parse(rawData);

const PAGE_SIZE = 100;

const manifest = {
    id: "org.criterion.pro.max",
    version: "1.0.0",
    name: "Criterion Full (RD Ready)",
    description: "Colección Criterion compatible 100% con Torrentio.",
    resources: ["catalog"], // Solo catálogo, Stremio hace el resto
    idPrefixes: ["tt"],     // Le decimos que usamos el estándar IMDB
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

const PORT = process.env.PORT || 7005;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`🚀 Servidor ultrarrápido iniciado en el puerto ${PORT}`);
