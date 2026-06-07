const { serveHTTP, addonBuilder } = require("stremio-addon-sdk");
const fs = require("fs");

// Leemos la base de datos congelada en 0.01 segundos
const rawData = fs.readFileSync("datos.json", "utf8");
const cachedMovies = JSON.parse(rawData);

const manifest = {
    id: "org.criterion.pro.max",
    version: "1.0.0",
    name: "Criterion Full (RD Ready)",
    description: "Colección Criterion completa con metadatos reales.",
    resources: ["catalog"],
    types: ["movie"],
    catalogs: [{ type: "movie", id: "criterion_cat", name: "Criterion Collection" }]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async () => {
    return { metas: cachedMovies };
});

const PORT = process.env.PORT || 7005;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`🚀 Servidor ultrarrápido iniciado en el puerto ${PORT}`);
