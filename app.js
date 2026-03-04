//#region - API CONFIGURATION

// Ini akan ikut domain semasa secara automatik
const API_BASE = window.location.origin;

console.log("API Base URL:", API_BASE);

//#endregion

//#region - BASEMAPS

// 1. OSM
const osm = new ol.layer.Tile({
  source: new ol.source.OSM(),
  visible: true,
  title: "osm"
});

// 2. Google Satellite
const googleSat = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
  }),
  visible: false,
  title: "googleSat"
});

// 3. ESRI Satellite
const esriSat = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url:
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  }),
  visible: false,
  title: "esriSat"
});

//#endregion

//#region - GEO SERVER CONFIG (LAYERS)

var pkmlink = 'https://gis.pkmgroup.com';

// Function to create WMS Image Layer
function createImageLayer(title, layerSource, visible, urlSource) {

  return new ol.layer.Image({
    title: title,
    visible: visible,

    source: new ol.source.ImageWMS({
      url: urlSource + '/geoserver/wms',
      params: {
        'LAYERS': layerSource,
        'TILED': true
      },
      ratio: 1,
      serverType: 'geoserver'
    })

  });

}

// Sabah Road Layer
var roadmap = createImageLayer(
  'Sabah Roads',
  'pkmgis:vw_road_map2',
  true,
  pkmlink
);

//#endregion

//#region - MAP INITIALIZATION

const map = new ol.Map({
  target: 'map',

  layers: [

    // new ol.layer.Tile({
    //   source: new ol.source.OSM()
    // }),
    osm, googleSat, esriSat,
    roadmap   // ← Layer GeoServer
    ],

    view: new ol.View({
    center: ol.proj.fromLonLat([116.14, 6.02]),
    zoom: 13
  })

});

//#endregion

//#region - THE ROUTING & MARKERS LAYER

// 1. Routing
const routeSource = new ol.source.Vector();

const routeLayer = new ol.layer.Vector({
  source: routeSource,
  style: [
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: "#2b1cff",   // outer dark
        width: 10
      })
    }),
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: "#6a5cff",   // inner bright
        width: 6
      })
    })
  ]
});

map.addLayer(routeLayer);

// 2. Markers
const markerSource = new ol.source.Vector();

const markerLayer = new ol.layer.Vector({
  source: markerSource
});

map.addLayer(markerLayer);

// Function: Add the markers
function addMarker(lon, lat, type, number = null) {

  const coord = ol.proj.fromLonLat([lon, lat]);

  let color = "orange";

  if (type === "start") color = "green";
  if (type === "end") color = "red";

  const marker = new ol.Feature({
    geometry: new ol.geom.Point(coord)
  });

  marker.setStyle(new ol.style.Style({

    image: new ol.style.Circle({
      radius: 9,
      fill: new ol.style.Fill({ color }),
      stroke: new ol.style.Stroke({
        color: "white",
        width: 3
      })
    }),

    text: number ? new ol.style.Text({
      text: number.toString(),
      fill: new ol.style.Fill({ color: "white" }),
      font: "bold 12px sans-serif"
    }) : null

  }));

  markerSource.addFeature(marker);
  
}

//#endregion

//#region - ROUTE BUTTON

document.getElementById("routeBtn").addEventListener("click", async () => {

  const start = document.getElementById("startSearch").value.trim();
  const end = document.getElementById("endSearch").value.trim();

  const stops = Array.from(document.querySelectorAll(".stopInput"))
    .map(input => input.value.trim())
    .filter(val => val !== "");

  if (!start || !end) {
    alert("Please enter start and destination");
    return;
  }

  const allPoints = [start, ...stops, end];

  routeSource.clear();   // clear route sekali sahaja

  let allCoordinates = [];
  let totalDistance = 0;

  for (let i = 0; i < allPoints.length - 1; i++) {

    try {

      //const response = await fetch(`${API_BASE}/route-by-name?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);

      const response = await fetch(`${API_BASE}/route-by-name?start=${encodeURIComponent(allPoints[i])}&end=${encodeURIComponent(allPoints[i+1])}`);

      const data = await response.json();

      console.log("Segment:", data);

      if (!data || !data.geometry) {
        console.warn("Route not found for segment:", allPoints[i], "→", allPoints[i+1]);
        continue;
      }

      const feature = new ol.format.GeoJSON().readFeature(data, {
        featureProjection: 'EPSG:3857'
      });

      const geometry = feature.getGeometry();

      if (geometry.getType() === "MultiLineString") {

        geometry.getCoordinates().forEach(line => {
          allCoordinates.push(...line);
        });

      } else {

        allCoordinates.push(...geometry.getCoordinates());
      }

      const distance = Number(data.properties?.distance);

      if (!isNaN(distance)) {
        totalDistance += distance;
      }

    } catch (err) {
      console.error("Routing error:", err);
    }
  }

  // create single merged polyline
      if (allCoordinates.length > 0) {

        const mergedFeature = new ol.Feature({
          geometry: new ol.geom.LineString(allCoordinates)
        });

        routeSource.addFeature(mergedFeature);

        map.getView().fit(mergedFeature.getGeometry(), {
          padding: [80,80,80,80],
          duration: 800
        });

        // =========================
        // ADD START / END MARKER
        // =========================

        markerSource.clear(); // buang marker lama

        const startCoord = allCoordinates[0];
        const endCoord = allCoordinates[allCoordinates.length - 1];

        const startLonLat = ol.proj.toLonLat(startCoord);
        const endLonLat = ol.proj.toLonLat(endCoord);

        addMarker(startLonLat[0], startLonLat[1], "start");
        addMarker(endLonLat[0], endLonLat[1], "end");

      }
  
  document.getElementById("result").innerHTML =
    "Total Distance: " + (totalDistance / 1000).toFixed(3) + " km";

});

//#endregion

//#region + Add Stop button
  let stopCount = 0;

  document.getElementById("addStop").addEventListener("click", () => {
    stopCount++;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Stop " + stopCount;
    input.className = "stopInput";

    document.getElementById("stopsContainer").appendChild(input);

    enableAutoSearch(input);
  });
//#endregion

//#region - Auto Searchable text

  function enableAutoSearch(inputElement) {
  inputElement.addEventListener("input", async function () {
    const query = this.value;
    if (query.length < 2) return;

    //const response = await fetch(`/search?q=${query}`);
    const response = await fetch(`${API_BASE}/search?q=${query}`);
    const data = await response.json();

    showSuggestions(data, this);
  });
}

function showSuggestions(data, inputElement) {
  const suggestionBox = document.getElementById("suggestions");
  suggestionBox.innerHTML = "";

  data.forEach(item => {
    const div = document.createElement("div");
    div.textContent = item.name;
    div.className = "suggestion-item";

    div.onclick = () => {
      inputElement.value = item.name;
      suggestionBox.innerHTML = "";
    };

    suggestionBox.appendChild(div);
  });
}

enableAutoSearch(document.getElementById("startSearch"));
enableAutoSearch(document.getElementById("endSearch"));

//#endregion

//#region - 'LOCATE ME' CONTROL
let locateActive = false;

class LocateControl extends ol.control.Control {
  constructor() {
    const button = document.createElement('button');
    button.innerHTML = '📍';
    button.title = "Locate Me";

    const element = document.createElement('div');
    element.className = 'locate-control ol-unselectable ol-control';
    element.appendChild(button);

    super({
      element: element
    });

    button.addEventListener('click', () => {

      locateActive = !locateActive;

      // jika tekan kali kedua → OFF
      if (!locateActive) {
        markerSource.clear();
        return;
      }

      navigator.geolocation.getCurrentPosition(position => {

        const lon = position.coords.longitude;
        const lat = position.coords.latitude;

        const coords = ol.proj.fromLonLat([lon, lat]);

        markerSource.clear();

        const marker = new ol.Feature({
          geometry: new ol.geom.Point(coords)
        });

        marker.setStyle(new ol.style.Style({
          image: new ol.style.Circle({
            radius: 8,
            fill: new ol.style.Fill({ color: "green" }),
            stroke: new ol.style.Stroke({
              color: "white",
              width: 2
            })
          })
        }));

        markerSource.addFeature(marker);

        map.getView().animate({
          center: coords,
          zoom: 16,
          duration: 800
        });

      });

    });

  }
}

map.addControl(new LocateControl());


//#endregion

//#region - CLEAR BUTTON

  document.getElementById("clearBtn").addEventListener("click", () => {

    document.getElementById("startSearch").value = "";
    document.getElementById("endSearch").value = "";
    document.getElementById("stopsContainer").innerHTML = "";
    document.getElementById("result").innerHTML = "";
    document.getElementById("suggestions").innerHTML = "";

    stopCount = 0;

    map.getLayers().getArray().forEach(layer => {
      if (layer instanceof ol.layer.Vector) {
        map.removeLayer(layer);
      }
    });

  });

//#endregion

//#region - TURN BY TURN DIRECTION LIST

function addDirection(text) {

  const div = document.createElement("div");

  div.className = "direction-item";

  div.innerText = text;

  document.getElementById("directions").appendChild(div);

}

//#endregion

//#region - BASEMAPS LAYER SWITCHER

  const layerBtn = document.getElementById("layerBtn");
  const layerMenu = document.getElementById("layerMenu");

  layerBtn.onclick = () => {

  layerMenu.style.display =
  layerMenu.style.display === "block" ? "none" : "block";

  };

  document.querySelectorAll("#layerMenu div").forEach(item=>{

  item.onclick = () => {

  const layer = item.dataset.layer;

  [osm,googleSat,esriSat].forEach(l=>{
  l.setVisible(l.get("title")===layer);
  });

  layerMenu.style.display="none";

  };

  });

//#endregion
