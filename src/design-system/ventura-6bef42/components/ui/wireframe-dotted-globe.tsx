"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

interface RotatingEarthProps {
  width?: number;
  height?: number;
  className?: string;
}

interface DotData {
  lng: number;
  lat: number;
}

export default function RotatingEarth({
  width = 400,
  height = 400,
  className = "",
}: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    const containerWidth = width;
    const containerHeight = height;
    const radius = Math.min(containerWidth, containerHeight) / 2.2;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    context.scale(dpr, dpr);

    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([containerWidth / 2, containerHeight / 2])
      .clipAngle(90);

    const path = d3.geoPath().projection(projection).context(context);

    const pointInPolygon = (point: [number, number], polygon: number[][]) => {
      const [x, y] = point;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    };

    const pointInFeature = (point: [number, number], feature: any): boolean => {
      const g = feature.geometry;
      if (g.type === "Polygon") {
        const c = g.coordinates;
        if (!pointInPolygon(point, c[0])) return false;
        for (let i = 1; i < c.length; i++) if (pointInPolygon(point, c[i])) return false;
        return true;
      } else if (g.type === "MultiPolygon") {
        for (const poly of g.coordinates) {
          if (pointInPolygon(point, poly[0])) {
            let inHole = false;
            for (let i = 1; i < poly.length; i++) if (pointInPolygon(point, poly[i])) { inHole = true; break; }
            if (!inHole) return true;
          }
        }
        return false;
      }
      return false;
    };

    const generateDotsInPolygon = (feature: any, dotSpacing = 16) => {
      const dots: [number, number][] = [];
      const [[minLng, minLat], [maxLng, maxLat]] = d3.geoBounds(feature);
      const step = dotSpacing * 0.08;
      for (let lng = minLng; lng <= maxLng; lng += step) {
        for (let lat = minLat; lat <= maxLat; lat += step) {
          const p: [number, number] = [lng, lat];
          if (pointInFeature(p, feature)) dots.push(p);
        }
      }
      return dots;
    };

    const allDots: DotData[] = [];
    let landFeatures: any = null;

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight);
      const currentScale = projection.scale();
      const scaleFactor = currentScale / radius;

      // Globe outline (no fill so background gradient is hidden)
      context.beginPath();
      context.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI);
      context.strokeStyle = "rgba(255,255,255,0.6)";
      context.lineWidth = 1.5 * scaleFactor;
      context.stroke();

      if (landFeatures) {
        const graticule = d3.geoGraticule();
        context.beginPath();
        path(graticule());
        context.strokeStyle = "rgba(255,255,255,0.18)";
        context.lineWidth = 0.8 * scaleFactor;
        context.stroke();

        context.beginPath();
        landFeatures.features.forEach((f: any) => path(f));
        context.strokeStyle = "rgba(255,255,255,0.45)";
        context.lineWidth = 0.8 * scaleFactor;
        context.stroke();

        allDots.forEach((dot) => {
          const p = projection([dot.lng, dot.lat]);
          if (p && p[0] >= 0 && p[0] <= containerWidth && p[1] >= 0 && p[1] <= containerHeight) {
            context.beginPath();
            context.arc(p[0], p[1], 1.1 * scaleFactor, 0, 2 * Math.PI);
            context.fillStyle = "rgba(255,255,255,0.55)";
            context.fill();
          }
        });
      }
    };

    const loadWorldData = async () => {
      try {
        const res = await fetch(
          "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json",
        );
        if (!res.ok) throw new Error("failed");
        landFeatures = await res.json();
        landFeatures.features.forEach((f: any) => {
          generateDotsInPolygon(f, 16).forEach(([lng, lat]) => allDots.push({ lng, lat }));
        });
        render();
      } catch {
        setError("Failed to load Earth");
      }
    };

    const rotation: [number, number] = [0, 0];
    let autoRotate = true;
    const speed = 0.25;

    const timer = d3.timer(() => {
      if (autoRotate) {
        rotation[0] += speed;
        projection.rotate(rotation);
        render();
      }
    });

    const handleMouseDown = (event: MouseEvent) => {
      autoRotate = false;
      const startX = event.clientX;
      const startY = event.clientY;
      const startRot: [number, number] = [rotation[0], rotation[1]];
      const onMove = (e: MouseEvent) => {
        const s = 0.5;
        rotation[0] = startRot[0] + (e.clientX - startX) * s;
        rotation[1] = Math.max(-90, Math.min(90, startRot[1] - (e.clientY - startY) * s));
        projection.rotate(rotation);
        render();
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setTimeout(() => { autoRotate = true; }, 10);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

    canvas.addEventListener("mousedown", handleMouseDown);

    loadWorldData();

    return () => {
      timer.stop();
      canvas.removeEventListener("mousedown", handleMouseDown);
    };
  }, [width, height]);

  if (error) {
    return <div className={className}>{error}</div>;
  }

  return <canvas ref={canvasRef} className={className} style={{ cursor: "grab" }} />;
}
