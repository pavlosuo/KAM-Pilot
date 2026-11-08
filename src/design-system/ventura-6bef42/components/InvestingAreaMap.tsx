import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { getInvestmentGeographyPreset } from "@/design-system/ventura-6bef42/lib/investment-geographies";

type Area =
  | { kind: "circle"; lat: number; lng: number; radiusKm: number; label: string }
  | { kind: "rect"; south: number; north: number; west: number; east: number; label: string };

const num = (value: string, hemi: string) => {
  const n = parseFloat(value);
  return hemi === "S" || hemi === "W" ? -n : n;
};

export function parseArea(label: string): Area | null {
  const clean = label.replace(/^Map area:\s*/i, "").trim();

  const circle = clean.match(
    /^([\d.]+)°([NS]),\s*([\d.]+)°([EW])\s*·\s*(\d+)\s*km radius$/i,
  );
  if (circle) {
    return {
      kind: "circle",
      lat: num(circle[1], circle[2].toUpperCase()),
      lng: num(circle[3], circle[4].toUpperCase()),
      radiusKm: parseInt(circle[5], 10),
      label: clean,
    };
  }

  const rect = clean.match(
    /^([\d.]+)°([NS])–([\d.]+)°([NS]),\s*([\d.]+)°([EW])–([\d.]+)°([EW])$/i,
  );
  if (rect) {
    return {
      kind: "rect",
      south: num(rect[1], rect[2].toUpperCase()),
      north: num(rect[3], rect[4].toUpperCase()),
      west: num(rect[5], rect[6].toUpperCase()),
      east: num(rect[7], rect[8].toUpperCase()),
      label: clean,
    };
  }

  return null;
}

export function InvestingAreaMap({
  open,
  onOpenChange,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: string[];
}) {
  const areas = labels.map(parseArea).filter(Boolean) as Area[];
  const places = labels.filter((l) => !parseArea(l));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Where they invest</DialogTitle>
        </DialogHeader>
        {open && (areas.length > 0 || places.length > 0) && (
          <AreaCanvas areas={areas} places={places} />
        )}
        {areas.length === 0 && places.length === 0 && (
          <p className="text-sm text-muted-foreground">No places were selected for this investor.</p>
        )}
        {places.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {places.map((o) => (
              <span key={o} className="rounded-full bg-muted px-3 py-1 text-xs text-foreground/80">
                {o}
              </span>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AreaCanvas({ areas, places }: { areas: Area[]; places: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let destroyed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      await import("leaflet/dist/leaflet.css");
      const L = await import("leaflet");
      if (destroyed || !containerRef.current) return;

      const map = L.map(containerRef.current, { center: [45, 15], zoom: 3, worldCopyJump: true });
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18,
        attribution: "&copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
      }).addTo(map);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18 }).addTo(map);

      const style = { color: "#2563eb", weight: 2, fillOpacity: 0.15 };
      const group = L.featureGroup().addTo(map);

      for (const area of areas) {
        const layer =
          area.kind === "circle"
            ? L.circle([area.lat, area.lng], { ...style, radius: area.radiusKm * 1000 })
            : L.rectangle(
                L.latLngBounds([area.south, area.west], [area.north, area.east]),
                style,
              );
        layer.bindTooltip(area.label);
        group.addLayer(layer);
      }

      const fit = () => {
        if (group.getLayers().length) map.fitBounds(group.getBounds().pad(0.3));
      };
      fit();
      setTimeout(() => map.invalidateSize(), 50);

      // Draw named places by looking up their outlines.
      void (async () => {
        for (const place of places) {
          try {
            const preset = getInvestmentGeographyPreset(place);
            const queries = preset?.queries ?? [place];
            for (const query of queries) {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=en&polygon_geojson=1&limit=1&q=${encodeURIComponent(query)}`,
                { headers: { Accept: "application/json" } },
              );
              if (!res.ok) continue;
              const rows = (await res.json()) as Array<{ geojson?: unknown }>;
              const geo = rows[0]?.geojson;
              if (destroyed || !geo) continue;
              const layer = L.geoJSON(geo as never, {
                style,
                pointToLayer: (_f, latlng) =>
                  L.circleMarker(latlng, { radius: 8, color: "#2563eb", fillOpacity: 0.4 }),
              });
              layer.bindTooltip(place);
              group.addLayer(layer);
            }
            fit();
          } catch {
            // ignore lookup failures
          }
        }
      })();

      cleanup = () => map.remove();
    })();

    return () => {
      destroyed = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="h-[420px] w-full select-none rounded-xl border" />;
}
