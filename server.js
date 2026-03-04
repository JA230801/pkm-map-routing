const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");

const app = express();

//app.use(cors());
app.use(cors({
  origin: [
    "https://gis.pkmgroup.com",
    "http://10.1.4.23",
    "https://10.1.4.23:3000"
    //"https://github.com/JA230801/pkm-map-routing"
  ]
}));

app.use(express.static(path.join(__dirname)));

const pool = new Pool({
  user: "gis_user",
  host: "192.168.0.35",
  database: "rmisv2db_prod",
  password: "pkmgis",
  port: 5433,
});

//#region - app.get("/route-by-name")
app.get("/route-by-name", async (req, res) => {

  const { start, end } = req.query;

  const result = await pool.query(`
    SELECT 
      ST_AsGeoJSON(geom) AS geometry,
      total_distance
    FROM _a_find_routing_by_name($1,$2)
  `, [start, end]);

  if (!result.rows.length) {
    return res.json(null);
  }

  const row = result.rows[0];

  res.json({
    type: "Feature",
    geometry: JSON.parse(row.geometry),   // 🔥 penting
    properties: {
      distance: row.total_distance
    }
  });

});
//#endregion

//#region Auto Searchable Text from view search_locations

app.get("/search", async (req, res) => {
  const q = req.query.q;

  const result = await pool.query(
    `SELECT DISTINCT ON (name)
        id,
        name,
        type
     FROM search_locations
     WHERE name ILIKE $1
     ORDER BY name
     LIMIT 100`,
    ['%' + q + '%']
  );

  res.json(result.rows);
});

//#endregion


// const PORT = 3000;

// const https = require("https");
// const fs = require("fs");

// const httpsOptions = {
//   key: fs.readFileSync("./server.key"),
//   cert: fs.readFileSync("./server.cert")
// };

// https.createServer(httpsOptions, app)
// .listen(3000, "0.0.0.0", () => {
//   console.log(`HTTPS server running at https://10.1.4.23:${PORT}`);
// });
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
