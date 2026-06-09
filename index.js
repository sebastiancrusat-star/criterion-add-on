const { serveHTTP, addonBuilder } = require("stremio-addon-sdk");
const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "datos.json");
const rawData = fs.readFileSync(dataPath, "utf8");
const cachedMovies = JSON.parse(rawData);

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
const listaDirectores = Array.from(directoresSet).sort();

const manifest = {
    id: "org.criterion.pro.max",
    version: "1.0.0",
    name: "Criterion Full",
    description: "Coleccion Criterion en Stremio",
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
                { name: "genre", options: listaDirectores, isRequired: false }
            ]
        }
    ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ extra }) => {
    let results = cachedMovies;

    if (extra && extra.search) {
        const query = extra.search.toLowerCase();
        results = results.filter((m) => {
            const coincideTitulo = m.name && m.name.toLowerCase().includes(query);
            const coincideDirector = m.director && m.director.some(d => d.toLowerCase().includes(query));
            return coincideTitulo || coincideDirector;
        });
    }

    if (extra && extra.genre) {
        results = results.filter((m) => m.director && m.director.includes(extra.genre));
    }

    const skip = parseInt((extra && extra.skip) || "0", 10);
    results = results.slice(skip, skip + 100);

    return { metas: results };
});

const PORT = process.env.PORT || 7005;
serveHTTP(builder.getInterface(), { port: PORT });
console.log("Servidor iniciado en el puerto " + PORT);
