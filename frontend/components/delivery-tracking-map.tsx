"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

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

export function DeliveryTrackingMap({ pickup, current, destination, routes }: {
  pickup?: DeliveryMapPoint | null;
  current?: DeliveryMapPoint | null;
  destination?: DeliveryMapPoint | null;
  routes?: DeliveryMapRoute[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<MapSize>({ width: 0, height: 0 });
  const [zoomOffset, setZoomOffset] = useState(0);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const mapRoutes = routes?.length
    ? routes
    : [{ id: "delivery", label: "Rider", pickup, current, destination }];
  const points = mapRoutes.flatMap(route => [route.pickup, route.current, route.destination])
    .filter((point): point is DeliveryMapPoint => Boolean(point));
  if (!points.length) {
    return <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-slate-100 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Map coordinates are not available for this delivery.</div>;
  }

  const basePoints = points.map(point => project(point, 0));
  const spreadX = Math.max(...basePoints.map(point => point.x)) - Math.min(...basePoints.map(point => point.x));
  const spreadY = Math.max(...basePoints.map(point => point.y)) - Math.min(...basePoints.map(point => point.y));
  const fitZoom = points.length === 1 || spreadX + spreadY < 0.0001
    ? 15
    : size.width && size.height
    ? Math.floor(Math.log2(Math.min((size.width - 96) / Math.max(spreadX, 0.0001), (size.height - 96) / Math.max(spreadY, 0.0001))))
    : 14;
  const zoom = Math.max(3, Math.min(19, fitZoom + zoomOffset));
  const projected = points.map(point => project(point, zoom));
  const centerX = projected.reduce((sum, point) => sum + point.x, 0) / projected.length;
  const centerY = projected.reduce((sum, point) => sum + point.y, 0) / projected.length;
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
      <div ref={container} className="relative h-72 overflow-hidden bg-slate-200 sm:h-96 dark:bg-slate-900">
        {tiles.map(tile => <Image key={tile.key} src={tile.url} alt="" width={256} height={256} unoptimized loading="lazy" draggable={false} className="pointer-events-none absolute max-w-none" style={{ width: 256, height: 256, left: tile.left, top: tile.top }} />)}
        {mapRoutes.some(route => (route.pickup && route.current) || (route.current && route.destination)) && <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {mapRoutes.flatMap(route => {
            const lines = [];
            if (route.pickup && route.current) {
              const from = toScreen(project(route.pickup, zoom));
              const to = toScreen(project(route.current, zoom));
              lines.push(<line key={`${route.id}-pickup`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#0f766e" strokeWidth="4" strokeDasharray="8 8" />);
            }
            if (route.current && route.destination) {
              const from = toScreen(project(route.current, zoom));
              const to = toScreen(project(route.destination, zoom));
              lines.push(<line key={`${route.id}-destination`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#0f766e" strokeWidth="4" strokeDasharray="8 8" />);
            }
            return lines;
          })}
        </svg>}
        {pickupMarkers.map(marker => <span key={marker.id} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: marker.point.x, top: marker.point.y }}>
          <span className="block size-5 rounded-full border-[3px] border-white bg-teal-600 shadow-lg" title="Pickup location" />
        </span>)}
        {riderMarkers.map(marker => <span key={marker.id} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: marker.point.x, top: marker.point.y }}>
          <span className="absolute -inset-2 animate-ping rounded-full bg-blue-500/30" />
          <span className="relative block size-5 rounded-full border-[3px] border-white bg-blue-600 shadow-lg" title={`${marker.label} current location`} />
        </span>)}
        {destinationMarkers.map(marker => <span key={marker.id} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: marker.point.x, top: marker.point.y }}>
          <span className="block size-5 rounded-full border-[3px] border-white bg-rose-600 shadow-lg" title={`${marker.label} destination`} />
        </span>)}
        {pickupMarkers.map(marker => <span key={`pickup-label-${marker.id}`} className="absolute z-20 -translate-x-1/2 rounded-md bg-teal-700 px-2 py-1 text-[10px] font-bold text-white shadow" style={{ left: marker.point.x, top: marker.point.y + 14 }}>Pickup</span>)}
        {riderMarkers.map(marker => <span key={`label-${marker.id}`} className="absolute z-20 -translate-x-1/2 rounded-md bg-blue-700 px-2 py-1 text-[10px] font-bold text-white shadow" style={{ left: marker.point.x, top: marker.point.y + 14 }}>{marker.label}</span>)}
        {destinationMarkers.map(marker => <span key={`destination-label-${marker.id}`} className="absolute z-20 -translate-x-1/2 rounded-md bg-rose-700 px-2 py-1 text-[10px] font-bold text-white shadow" style={{ left: marker.point.x, top: marker.point.y + 14 }}>Destination</span>)}
        <div className="absolute right-3 top-3 z-30 grid overflow-hidden rounded-lg border border-slate-300 bg-white shadow dark:border-slate-600 dark:bg-slate-800">
          <button type="button" onClick={() => setZoomOffset(offset => Math.min(offset + 1, 8))} aria-label="Zoom in" className="size-9 text-lg font-bold text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700">+</button>
          <button type="button" onClick={() => setZoomOffset(offset => Math.max(offset - 1, -8))} aria-label="Zoom out" className="size-9 border-t border-slate-200 text-lg font-bold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700">−</button>
        </div>
        {!size.width && <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-800" />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
        <div className="flex gap-4"><span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-teal-600" />Pickup</span><span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-blue-600" />Rider</span><span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-rose-600" />Destination</span></div>
        <div className="flex flex-wrap items-center gap-3"><span>Dashed line shows direct distance; use navigation for road directions.</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline underline-offset-2">© OpenStreetMap contributors</a></div>
      </div>
    </div>
  );
}
