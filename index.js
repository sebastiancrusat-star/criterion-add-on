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
    resources: ["catalog"], 
    idPrefixes: ["tt"],     
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
        
        // 🚀 NUEVO BUSCADOR DOBLE (Título + Director)
        results = results.filter((m) => {
            // 1. ¿El texto coincide con el título de la peli?
            const coincideTitulo = m.name && m.name.toLowerCase().includes(query);
            
            // 2. ¿El texto coincide con el nombre del director?
            const coincideDirector = m.director && m.director.some(d => d.toLowerCase().includes(query));
            
            // Si coincide con alguna de las dos opciones, la mostramos en pantalla
            return coincideTitulo || coincideDirector;
        });
    }

    const skip = parseInt(extra?.skip || "0", 10);
    results = results.slice(skip, skip + PAGE_SIZE);

    return { metas: results };
});

const PORT = process.env.PORT || 7005;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`🚀 Servidor ultrarrápido iniciado en el puerto ${PORT}`);
