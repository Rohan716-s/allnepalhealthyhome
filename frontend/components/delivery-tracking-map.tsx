"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useNetworkStatus } from "@/lib/offline/network-status";

export type DeliveryMapPoint = {
  latitude: number;
  longitude: number;
};
export type DeliveryMapRoute = {
  id: string;
  label: string;
  pickup?: DeliveryMapPoint | null;
  current?: DeliveryMapPoint | null;
  destination?: DeliveryMapPoint | null;
};

type MapSize = { width: number; height: number };

function project(point: DeliveryMapPoint, zoom: number) {
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const worldSize = 256 * 2 ** zoom;
  const sine = Math.sin(latitude * Math.PI / 180);
  return {
    x: (point.longitude + 180) / 360 * worldSize,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * worldSize,
  };
}

function wrapTile(value: number, max: number) {
  return ((value % max) + max) % max;
}

export function DeliveryTrackingMap({ pickup, current, destination, routes, onSelect, selection = false, showViewerLocation = true }: {
  pickup?: DeliveryMapPoint | null;
  current?: DeliveryMapPoint | null;
  destination?: DeliveryMapPoint | null;
  routes?: DeliveryMapRoute[];
  onSelect?: (point: DeliveryMapPoint) => void;
  selection?: boolean;
  showViewerLocation?: boolean;
}) {
  const { online } = useNetworkStatus();
  const [failedTiles, setFailedTiles] = useState<string[]>([]);
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<MapSize>({ width: 0, height: 0 });
  const [zoomOffset, setZoomOffset] = useState(0);
  const [viewer, setViewer] = useState<DeliveryMapPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [focusedPoint, setFocusedPoint] = useState<DeliveryMapPoint | null>(null);
  const [loadedTiles, setLoadedTiles] = useState<string[]>([]);
  const viewerWatch = useRef<number | null>(null);

  useEffect(() => () => {
    if (viewerWatch.current !== null) navigator.geolocation?.clearWatch(viewerWatch.current);
  }, []);

  function locateViewer() {
    if (!navigator.geolocation) {
      setLocationError("Location is unavailable in this browser.");
      return;
    }
    if (viewerWatch.current !== null) navigator.geolocation.clearWatch(viewerWatch.current);
    setLocating(true);
    setLocationError("");
    // The viewer's position stays on this device; it is never a rider update.
    const locate = selection ? navigator.geolocation.getCurrentPosition.bind(navigator.geolocation) : navigator.geolocation.watchPosition.bind(navigator.geolocation);
    const watch = locate(position => {
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setViewer(point);
      onSelect?.(point);
      setLocating(false);
      setLocationError("");
    }, error => {
      setLocating(false);
      setLocationError(error.code === error.PERMISSION_DENIED
        ? "Location permission is required to automatically detect your location. You can also select your location manually."
        : "Your location could not be found. Check GPS and try again.");
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
    viewerWatch.current = typeof watch === "number" ? watch : null;
  }

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rawRoutes = routes?.length
    ? routes
    : [{ id: "delivery", label: "Rider", pickup, current, destination }];
  const validPoint = (point?: DeliveryMapPoint | null) => point
    && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180 ? point : null;
  const mapRoutes = rawRoutes.map(route => ({ ...route,
    pickup: validPoint(route.pickup), current: validPoint(route.current), destination: validPoint(route.destination),
  }));
  const points = mapRoutes.flatMap(route => [route.pickup, route.current, route.destination])
    .filter((point): point is DeliveryMapPoint => Boolean(point));
  const hasDeliveryPoints = points.length > 0;
  // A picker follows the selected form value after manual adjustment. Including
  // the old GPS fix in its bounds would zoom out and move the map on every click.
  if (viewer && (!selection || !hasDeliveryPoints)) points.push(viewer);
  // Show a regional map until real coordinates arrive; never invent a rider.
  if (!points.length) points.push({ latitude: 28.3949, longitude: 84.124 });

  const boundsPoints = focusedPoint ? [focusedPoint] : points;

  const basePoints = boundsPoints.map(point => project(point, 0));
  const spreadX = Math.max(...basePoints.map(point => point.x)) - Math.min(...basePoints.map(point => point.x));
  const spreadY = Math.max(...basePoints.map(point => point.y)) - Math.min(...basePoints.map(point => point.y));
  const fitZoom = !hasDeliveryPoints && !viewer ? 7 : boundsPoints.length === 1 || spreadX + spreadY < 0.0001
    ? 15
    : size.width && size.height
    ? Math.floor(Math.log2(Math.min(Math.max(64, size.width - 192) / Math.max(spreadX, 0.0001), Math.max(64, size.height - 128) / Math.max(spreadY, 0.0001))))
    : 14;
  const zoom = Math.max(3, Math.min(19, fitZoom + zoomOffset));
  const projected = boundsPoints.map(point => project(point, zoom));
  // Center the bounds so every endpoint stays inside the fitted map.
  const centerX = (Math.min(...projected.map(point => point.x)) + Math.max(...projected.map(point => point.x))) / 2;
  const centerY = (Math.min(...projected.map(point => point.y)) + Math.max(...projected.map(point => point.y))) / 2;
  const left = centerX - size.width / 2;
  const top = centerY - size.height / 2;
  const firstTileX = Math.floor(left / 256);
  const lastTileX = Math.floor((left + size.width) / 256);
  const firstTileY = Math.floor(top / 256);
  const lastTileY = Math.floor((top + size.height) / 256);
  const tileCount = 2 ** zoom;
  const tiles = [];
  for (let x = firstTileX; x <= lastTileX; x += 1) {
    for (let y = firstTileY; y <= lastTileY; y += 1) {
      if (y < 0 || y >= tileCount) continue;
      tiles.push({
        key: `${x}-${y}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrapTile(x, tileCount)}/${y}.png`,
        left: x * 256 - left,
        top: y * 256 - top,
      });
    }
  }

  const toScreen = (point: { x: number; y: number }) => ({ x: point.x - left, y: point.y - top });
  const riderMarkers = mapRoutes.flatMap(route => route.current
    ? [{ id: route.id, label: route.label, point: toScreen(project(route.current, zoom)) }]
    : []);
  const pickupMarkers = mapRoutes.flatMap(route => route.pickup
    ? [{ id: route.id, point: toScreen(project(route.pickup, zoom)) }]
    : []);
  const destinationMarkers = mapRoutes.flatMap(route => route.destination
    ? [{ id: route.id, label: route.label, point: toScreen(project(route.destination, zoom)) }]
    : []);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
      <div ref={container} className={`relative isolate z-0 h-80 overflow-hidden bg-slate-200 sm:h-96 dark:bg-slate-900 ${selection ? "cursor-crosshair" : ""}`} aria-label={selection ? "Select location on map" : "Delivery map"}
        onClick={event => {
          if (!onSelect || (event.target as Element).closest("button,a")) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const world = 256 * 2 ** zoom;
          const x = left + event.clientX - rect.left;
          const y = top + event.clientY - rect.top;
          const longitude = ((x / world * 360) % 360 + 360) % 360 - 180;
          const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / world))) * 180 / Math.PI;
          onSelect({ latitude, longitude });
        }}>
        {(!online || (tiles.length > 0 && tiles.every(tile => failedTiles.includes(tile.url)))) && <p role="status" className="absolute left-3 right-14 top-3 z-30 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow dark:bg-slate-800/95 dark:text-slate-200">{!online ? "Map requires an internet connection." : "Map tiles could not load. Check your connection and try again."} Saved coordinates are kept.</p>}
        {!hasDeliveryPoints && !selection && <p role="status" className="absolute bottom-3 left-3 right-3 z-30 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow dark:bg-slate-800/95 dark:text-slate-200">Waiting for delivery GPS. The rider will appear when location sharing starts.</p>}
        {online && tiles.length > 0 && !tiles.some(tile => loadedTiles.includes(tile.url)) && !tiles.every(tile => failedTiles.includes(tile.url)) && <p role="status" className="absolute left-3 right-14 top-3 z-30 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow">Loading map…</p>}
        {viewer && <span className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: toScreen(project(viewer, zoom)).x, top: toScreen(project(viewer, zoom)).y }}><span className="block size-5 rounded-full border-[3px] border-white bg-purple-600 shadow-lg" title="Your location" /><span className="absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded-md bg-purple-700 px-2 py-1 text-[10px] font-bold text-white">You</span></span>}
        {online && tiles.map(tile => <Image key={`${tile.key}-${online}`} onError={() => setFailedTiles(old => old.includes(tile.url) ? old : [...old.slice(-100), tile.url])} onLoad={() => { setFailedTiles(old => old.filter(url => url !== tile.url)); setLoadedTiles(old => old.includes(tile.url) ? old : [...old.slice(-100), tile.url]); }} src={tile.url} alt="" width={256} height={256} unoptimized loading="eager" draggable={false} className={`pointer-events-none absolute max-w-none ${failedTiles.includes(tile.url) ? "invisible" : ""}`} style={{ width: 256, height: 256, left: tile.left, top: tile.top }} />)}
        {mapRoutes.some(route => (route.pickup && route.current) || (route.current && route.destination) || (route.pickup && route.destination)) && <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {mapRoutes.flatMap(route => {
            const lines = [];
            if (route.pickup && route.current) {
              const from = toScreen(project(route.pickup, zoom));
              const to = toScreen(project(route.current, zoom));
              lines.push(<line key={`${route.id}-pickup`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#2563eb" strokeWidth="3" strokeDasharray="7 7" />);
            }
            if (route.current && route.destination) {
              const from = toScreen(project(route.current, zoom));
              const to = toScreen(project(route.destination, zoom));
              lines.push(<line key={`${route.id}-destination`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#e11d48" strokeWidth="3" strokeDasharray="7 7" />);
            }
            if (!route.current && route.pickup && route.destination) {
              const from = toScreen(project(route.pickup, zoom));
              const to = toScreen(project(route.destination, zoom));
              lines.push(<line key={`${route.id}-planned`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#64748b" strokeWidth="3" strokeDasharray="7 7" />);
            }
            return lines;
          })}
        </svg>}
        {pickupMarkers.map(marker => <span key={marker.id} data-map-marker="pickup" className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: marker.point.x, top: marker.point.y }}>
          <span className="grid size-7 place-items-center rounded-lg border-2 border-white bg-blue-600 text-xs font-extrabold text-white shadow-lg" title="Pickup location">P</span>
        </span>)}
        {riderMarkers.map(marker => <span key={marker.id} data-map-marker="rider" className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: marker.point.x, top: marker.point.y }}>
          <span className="absolute -inset-1 rounded-full bg-emerald-500/20" />
          <span className="relative grid size-6 place-items-center rounded-full border-2 border-white bg-emerald-600 text-[10px] font-extrabold text-white shadow-lg" title={`${marker.label} current location`}>R</span>
        </span>)}
        {destinationMarkers.map(marker => <span key={marker.id} data-map-marker="destination" className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: marker.point.x, top: marker.point.y }}>
          <span className="grid size-7 place-items-center rounded-lg border-2 border-white bg-rose-600 text-xs font-extrabold text-white shadow-lg" title={`${marker.label} destination`}>{selection ? "●" : "D"}</span>
        </span>)}
        {pickupMarkers.map(marker => <span key={`pickup-label-${marker.id}`} className="absolute z-20 -translate-x-full whitespace-nowrap rounded-md bg-blue-700 px-2 py-1 text-[10px] font-bold text-white shadow" style={{ left: marker.point.x - 8, top: marker.point.y - 36 }}>Pickup</span>)}
        {riderMarkers.map(marker => <span key={`label-${marker.id}`} className="absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white shadow" style={{ left: marker.point.x, top: marker.point.y + 16 }}>{marker.label}</span>)}
        {destinationMarkers.map(marker => <span key={`destination-label-${marker.id}`} className="absolute z-20 whitespace-nowrap rounded-md bg-rose-700 px-2 py-1 text-[10px] font-bold text-white shadow" style={{ left: marker.point.x + 8, top: marker.point.y - 36 }}>{selection ? "Selected location" : "Destination"}</span>)}
        <div className="absolute right-3 top-3 z-30 grid overflow-hidden rounded-lg border border-slate-300 bg-white shadow dark:border-slate-600 dark:bg-slate-800">
          <button type="button" onClick={() => setZoomOffset(offset => Math.min(offset + 1, 8))} aria-label="Zoom in" className="size-9 text-lg font-bold text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700">+</button>
          <button type="button" onClick={() => setZoomOffset(offset => Math.max(offset - 1, -8))} aria-label="Zoom out" className="size-9 border-t border-slate-200 text-lg font-bold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700">−</button>
        </div>
        {!size.width && <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-800" />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
        {showViewerLocation && <button type="button" onClick={locateViewer} disabled={locating} className="rounded-lg border border-slate-300 px-3 py-2 font-bold disabled:opacity-60 dark:border-slate-600">{locating ? "Finding your location…" : "Show my location"}</button>}
        {locationError && <p role="alert" className="text-rose-600">{locationError}</p>}
        {!selection && <div className="flex flex-wrap gap-2" aria-label="Map locations">
          {[{ label: "Pickup", point: mapRoutes.find(route => route.pickup)?.pickup, color: "bg-blue-600" }, { label: "Rider", point: mapRoutes.find(route => route.current)?.current, color: "bg-emerald-600" }, { label: "Destination", point: mapRoutes.find(route => route.destination)?.destination, color: "bg-rose-600" }].map(item => <button key={item.label} type="button" disabled={!item.point} onClick={() => { setFocusedPoint(item.point ?? null); setZoomOffset(0); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 font-bold disabled:text-slate-400 dark:border-slate-700"><span className={`size-2.5 rounded-full ${item.color}`} />{item.label}{!item.point && <span className="font-normal">· {item.label === "Rider" ? "waiting for GPS" : "not pinned"}</span>}</button>)}
          <button type="button" onClick={() => { setFocusedPoint(null); setZoomOffset(0); }} className="min-h-10 rounded-lg border border-slate-200 px-3 font-bold dark:border-slate-700">Fit route</button>
        </div>}
        <div className="flex flex-wrap items-center gap-3"><span>{selection ? "Click the map to adjust your location." : "Dashed line shows direct distance; use navigation for road directions."}</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline underline-offset-2">© OpenStreetMap contributors</a></div>
      </div>
    </div>
  );
}
