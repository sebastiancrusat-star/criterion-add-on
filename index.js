const { serveHTTP, addonBuilder } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path"); // 👈 La brújula nueva

// Le decimos a Render que busque el archivo EXACTAMENTE en la misma carpeta que este script
const dataPath = path.join(__dirname, "datos.json");
const rawData = fs.readFileSync(dataPath, "utf8");
const cachedMovies = JSON.parse(rawData);
// 🚀 NUEVO: Extraemos todos los directores únicos de tu lista para armar el menú
const directoresSet = new Set();
cachedMovies.forEach(m => {
    if (m.director && Array.isArray(m.director)) {
        m.director.forEach(d => {
            if (d && d.trim() !== "") {
                directoresSet.add(d.trim());
            }
        });
    }
});
// Los ordenamos alfabéticamente
const listaDirectores = Array.from(directoresSet).sort();

const PAGE_SIZE = 100;

const manifest = {
    id: "org.criterion.pro.max",
    version: "1.0.0",
    name: "Criterion Full (RD Ready)",
    description: "Colección Criterion compatible 100% con Torrentio.",
    resources: ["catalog"], 
    idPrefixes: ["tt"],     
    types: ["movie"],
    catalogs: [
        { 
            type: "movie", 
            id: "criterion_cat", 
            name: "Criterion Collection",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip", isRequired: false },
                // 🚀 NUEVO: Le decimos a Stremio que cree un menú desplegable con la lista
                { name: "genre", options: listaDirectores, isRequired: false }
            ]
        }
    ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ extra }) => {
    let results = cachedMovies;

    // 1. Filtro por la barra de búsqueda de arriba
    if (extra?.search) {
        const query = extra.search.toLowerCase();
        results = results.filter((m) => {
            const coincideTitulo = m.name && m.name.toLowerCase().includes(query);
            const coincideDirector = m.director && m.director.some(d => d.toLowerCase().includes(query));
            return coincideTitulo || coincideDirector;
        });
    }

    // 2. Filtro por el nuevo menú desplegable de directores
    if (extra?.genre) {
        results = results.filter((m) => m.director && m.director.includes(extra.genre));
    }

    const skip = parseInt(extra?.skip || "0", 10);
    results = results.slice(skip, skip + PAGE_SIZE);

    return { metas: results };
});

const PORT = process.env.PORT || 7005;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`🚀 Servidor ultrarrápido iniciado en el puerto ${PORT}`);
