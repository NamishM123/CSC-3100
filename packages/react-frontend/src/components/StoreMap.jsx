import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { coordinatesOf } from "../lib/geo.js";
import { miles } from "../lib/format.js";

const TILE_URL =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function storePopup(store, sample, navigate) {
  const content = document.createElement("div");
  content.className = "store-map-popup";
  const name = document.createElement("strong");
  name.textContent = store.name;
  content.append(name);

  if (sample) {
    const label = document.createElement("p");
    label.textContent = "Sample store location";
    content.append(label);
  }
  const address = document.createElement("p");
  address.textContent = [store.address, store.city]
    .filter(Boolean)
    .join(", ");
  content.append(address);
  const distance = document.createElement("p");
  distance.textContent = `${miles(store.distance_mi)} away | straight-line distance`;
  content.append(distance);
  const link = document.createElement("a");
  link.href = `/stores/${encodeURIComponent(store.id)}`;
  link.textContent = "View store";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(link.getAttribute("href"));
  });
  content.append(link);
  return content;
}

export default function StoreMap({
  place,
  stores,
  radiusMi,
  sample = false
}) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const tilesRef = useRef(null);
  const markersRef = useRef(null);
  const [tileStatus, setTileStatus] = useState("loading");
  const helpId = useId();
  const navigate = useNavigate();
  const { latitude, longitude } = coordinatesOf(place);
  const approximate = place.source === "zip";
  const locationLabel = approximate
    ? `ZIP ${place.zip} area (approximate)`
    : "Your location";

  useEffect(() => {
    const map = L.map(container.current, {
      minZoom: 2,
      maxZoom: 19,
      scrollWheelZoom: true,
      dragging: true,
      touchZoom: true,
      keyboard: true
    });
    mapRef.current = map;
    const tiles = L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      updateWhenIdle: true,
      keepBuffer: 1
    });
    tilesRef.current = tiles;
    let failed = false;
    tiles.on("loading", () => {
      failed = false;
      setTileStatus("loading");
    });
    tiles.on("tileerror", () => {
      failed = true;
      setTileStatus("error");
    });
    tiles.on("load", () => {
      setTileStatus(failed ? "error" : "ready");
    });
    tiles.addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    L.control
      .scale({ imperial: true, metric: false })
      .addTo(map);

    const resize = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      tiles.off();
      map.remove();
      mapRef.current = null;
      tilesRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current.setView([latitude, longitude], 13);
  }, [latitude, longitude]);

  useEffect(() => {
    const layer = markersRef.current;
    layer.clearLayers();
    const center = [latitude, longitude];
    L.circle(center, {
      radius: radiusMi * 1609.344,
      color: "#2e7d32",
      weight: 1,
      dashArray: "5 7",
      fillColor: "#2e7d32",
      fillOpacity: 0.04,
      interactive: false
    }).addTo(layer);

    const userIcon = document.createElement("span");
    userIcon.className = "store-map-user-dot";
    const userMarker = L.marker(center, {
      icon: L.divIcon({
        html: userIcon,
        className: "store-map-user",
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      }),
      title: locationLabel,
      alt: locationLabel,
      zIndexOffset: 1000
    })
      .bindTooltip(locationLabel)
      .addTo(layer);
    userMarker
      .getElement()
      ?.setAttribute("aria-label", locationLabel);

    for (const store of stores) {
      const coordinates = coordinatesOf(store);
      if (!coordinates) continue;
      const label = document.createElement("span");
      label.textContent = store.name.slice(0, 2).toUpperCase();
      const marker = L.marker(
        [coordinates.latitude, coordinates.longitude],
        {
          icon: L.divIcon({
            html: label,
            className: "store-map-pin",
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -32]
          }),
          title: store.name,
          alt: store.name,
          riseOnHover: true
        }
      )
        .bindPopup(storePopup(store, sample, navigate))
        .addTo(layer);
      marker
        .getElement()
        ?.setAttribute("aria-label", store.name);
    }
  }, [
    latitude,
    longitude,
    radiusMi,
    locationLabel,
    stores,
    sample,
    navigate
  ]);

  function pan(x, y) {
    mapRef.current?.panBy([x, y], { animate: true });
  }

  function recenter() {
    mapRef.current?.setView([latitude, longitude], 13);
  }

  function showStores() {
    const points = [
      [latitude, longitude],
      ...stores.map((store) => [
        store.latitude,
        store.longitude
      ])
    ];
    if (points.length === 1) {
      recenter();
      return;
    }
    mapRef.current?.fitBounds(points, {
      padding: [40, 40],
      maxZoom: 14
    });
  }

  return (
    <section className="store-map-panel" aria-label="Store map">
      <div className="store-map-toolbar">
        <span className="store-map-location">
          <span aria-hidden="true" className="location-dot" />
          {locationLabel}
        </span>
        <button type="button" onClick={showStores}>
          Show stores
        </button>
      </div>
      <div className="store-map-frame">
        <div
          ref={container}
          className="store-map-canvas"
          role="region"
          aria-label="Interactive store map"
          aria-describedby={helpId}
        />
        <div
          className="store-map-directions"
          role="group"
          aria-label="Move map">
          <button
            className="north"
            type="button"
            aria-label="Pan up"
            onClick={() => pan(0, -100)}>
            &uarr;
          </button>
          <button
            className="west"
            type="button"
            aria-label="Pan left"
            onClick={() => pan(-100, 0)}>
            &larr;
          </button>
          <button
            className="center"
            type="button"
            aria-label="Center on your location"
            onClick={recenter}>
            &#9678;
          </button>
          <button
            className="east"
            type="button"
            aria-label="Pan right"
            onClick={() => pan(100, 0)}>
            &rarr;
          </button>
          <button
            className="south"
            type="button"
            aria-label="Pan down"
            onClick={() => pan(0, 100)}>
            &darr;
          </button>
        </div>
      </div>
      <p id={helpId} className="fine store-map-help">
        Drag to move. Scroll, pinch, or use + and - to zoom. You
        can also focus the map and use the arrow keys.
      </p>
      {tileStatus === "loading" ? (
        <p className="fine" role="status">
          Loading street map...
        </p>
      ) : null}
      {tileStatus === "error" ? (
        <div className="store-map-error" role="alert">
          <p>
            Some map tiles could not load. Check your
            connection.
          </p>
          <button
            type="button"
            className="text-link"
            onClick={() => tilesRef.current?.redraw()}>
            Retry map
          </button>
        </div>
      ) : null}
    </section>
  );
}
