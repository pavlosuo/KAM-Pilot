import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { INVESTMENT_GEOGRAPHY_PRESETS } from "@/design-system/ventura-6bef42/lib/investment-geographies";

export interface PickedPlace {
  id: string;
  label: string;
  geojson?: unknown;
  bbox?: [number, number, number, number]; // south, north, west, east
}

export interface MapAreaSelection {
  labels: string[];
}

const NOMINATIM = "https://nominatim.openstreetmap.org";

function labelFromAddress(a: Record<string, string> | undefined, fallback: string): string {
  if (!a) return fallback;
  const country = a["country"];
  const place =
    a["city"] ||
    a["town"] ||
    a["village"] ||
    a["municipality"] ||
    a["county"] ||
    a["state"] ||
    a["region"];
  if (place && country && place !== country) return `${place}, ${country}`;
  return country || place || fallback;
}

/** Map the Leaflet zoom level onto a Nominatim admin granularity. */
function nominatimZoom(mapZoom: number): number {
  if (mapZoom <= 5) return 3; // country
  if (mapZoom <= 7) return 5; // state / region
  if (mapZoom <= 9) return 8; // county
  return 10; // city
}

export function MapAreaPicker({
  open,
  onOpenChange,
  onApply,
  initialLabels = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (selection: MapAreaSelection) => void;
  initialLabels?: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pick the places you invest in</DialogTitle>
        </DialogHeader>
        {open && <PlacePickerCanvas onApply={onApply} initialLabels={initialLabels} />}
      </DialogContent>
    </Dialog>
  );
}

function PlacePickerCanvas({
  onApply,
  initialLabels,
}: {
  onApply: (s: MapAreaSelection) => void;
  initialLabels: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const layersRef = useRef<Record<string, import("leaflet").Layer>>({});

  const [places, setPlaces] = useState<PickedPlace[]>(
    initialLabels.map((l) => ({ id: `seed:${l}`, label: l })),
  );
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedPlace[]>([]);
  const [searching, setSearching] = useState(false);

  const placesRef = useRef(places);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  const drawPlace = useCallback((place: PickedPlace) => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !place.geojson) return;
    const layer = L.geoJSON(place.geojson as never, {
      style: { color: "#2563eb", weight: 2, fillOpacity: 0.18 },
      pointToLayer: (_f, latlng) =>
        L.circleMarker(latlng, { radius: 8, color: "#2563eb", fillOpacity: 0.4 }),
    }).addTo(map);
    layer.bindTooltip(place.label);
    layersRef.current[place.id] = layer;
  }, []);

  const addPlace = useCallback(
    (place: PickedPlace, fit = false) => {
      if (placesRef.current.some((p) => p.label === place.label)) return;
      setPlaces((prev) => [...prev, place]);
      drawPlace(place);
      if (fit && place.bbox && mapRef.current && LRef.current) {
        const [s, n, w, e] = place.bbox;
        mapRef.current.fitBounds(LRef.current.latLngBounds([s, w], [n, e]).pad(0.2));
      }
    },
    [drawPlace],
  );

  const removePlace = (id: string) => {
    const layer = layersRef.current[id];
    if (layer && mapRef.current) mapRef.current.removeLayer(layer);
    delete layersRef.current[id];
    setPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  const addPreset = async (label: string, queries: string[]) => {
    if (placesRef.current.some((place) => place.label === label)) return;
    setLoading(true);
    try {
      const rows = await Promise.all(
        queries.map(async (presetQuery) => {
          const response = await fetch(
            `${NOMINATIM}/search?format=jsonv2&accept-language=en&polygon_geojson=1&limit=1&q=${encodeURIComponent(presetQuery)}`,
            { headers: { Accept: "application/json" } },
          );
          if (!response.ok) return null;
          const matches = (await response.json()) as Array<{
            geojson?: unknown;
            boundingbox?: string[];
          }>;
          return matches[0] ?? null;
        }),
      );
      const matches = rows.filter((row) => row?.geojson);
      const boxes = rows
        .map((row) => row?.boundingbox?.map(Number))
        .filter((box): box is number[] => Boolean(box && box.length === 4));
      const bbox: [number, number, number, number] | undefined = boxes.length
        ? [
            Math.min(...boxes.map((box) => box[0] ?? 90)),
            Math.max(...boxes.map((box) => box[1] ?? -90)),
            Math.min(...boxes.map((box) => box[2] ?? 180)),
            Math.max(...boxes.map((box) => box[3] ?? -180)),
          ]
        : undefined;
      addPlace(
        {
          id: `preset:${label}`,
          label,
          geojson: matches.length
            ? {
                type: "FeatureCollection",
                features: matches.map((row) => ({
                  type: "Feature",
                  properties: {},
                  geometry: row?.geojson,
                })),
              }
            : undefined,
          bbox,
        },
        true,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let destroyed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      await import("leaflet/dist/leaflet.css");
      const L = await import("leaflet");
      if (destroyed || !containerRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(containerRef.current, { center: [50, 12], zoom: 4, worldCopyJump: true });
      mapRef.current = map;

      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18,
        attribution: "&copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
      }).addTo(map);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18 }).addTo(map);

      map.on("click", async (e: import("leaflet").LeafletMouseEvent) => {
        setLoading(true);
        try {
          const z = nominatimZoom(map.getZoom());
          const res = await fetch(
            `${NOMINATIM}/reverse?format=jsonv2&accept-language=en&polygon_geojson=1&zoom=${z}&lat=${e.latlng.lat}&lon=${e.latlng.lng}`,
            { headers: { Accept: "application/json" } },
          );
          if (!res.ok) return;
          const data = (await res.json()) as {
            osm_id?: number;
            display_name?: string;
            address?: Record<string, string>;
            geojson?: unknown;
            boundingbox?: string[];
          };
          if (!data || (!data.display_name && !data.address)) return;
          const label = labelFromAddress(data.address, data.display_name ?? "");
          if (!label) return;
          const bb = data.boundingbox?.map(Number);
          addPlace({
            id: `osm:${data.osm_id ?? label}:${z}`,
            label,
            geojson: data.geojson,
              bbox:
                bb && bb.length === 4 && bb[0] !== undefined && bb[1] !== undefined && bb[2] !== undefined && bb[3] !== undefined
                  ? [bb[0], bb[1], bb[2], bb[3]]
                  : undefined,
          });
        } finally {
          setLoading(false);
        }
      });

      setTimeout(() => map.invalidateSize(), 50);

      cleanup = () => {
        map.remove();
        mapRef.current = null;
        layersRef.current = {};
      };
    })();

    return () => {
      destroyed = true;
      cleanup?.();
    };
  }, [addPlace]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${NOMINATIM}/search?format=jsonv2&accept-language=en&polygon_geojson=1&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{
          osm_id?: number;
          display_name?: string;
          address?: Record<string, string>;
          geojson?: unknown;
          boundingbox?: string[];
        }>;
        setResults(
          rows.map((r) => {
            const bb = r.boundingbox?.map(Number);
            return {
              id: `osm:${r.osm_id ?? r.display_name}`,
              label: labelFromAddress(r.address, r.display_name ?? ""),
              geojson: r.geojson,
              bbox:
                bb && bb.length === 4 && bb[0] !== undefined && bb[1] !== undefined && bb[2] !== undefined && bb[3] !== undefined
                  ? [bb[0], bb[1], bb[2], bb[3]]
                  : undefined,
            };
          }),
        );
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a country, region or city"
          className="pl-9"
        />
        {(results.length > 0 || searching) && (
          <div className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
            {searching && results.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  addPlace(r, true);
                  setQuery("");
                  setResults([]);
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Popular investment areas">
        {INVESTMENT_GEOGRAPHY_PRESETS.map((preset) => {
          const selected = places.some((place) => place.label === preset.label);
          return (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              disabled={loading}
              onClick={() => void addPreset(preset.label, preset.queries)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>

      {places.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {places.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-3 py-1 text-sm text-background"
            >
              {p.label}
              <button
                type="button"
                aria-label={`Remove ${p.label}`}
                onClick={() => removePlace(p.id)}
                className="cursor-pointer rounded-full p-0.5 hover:bg-background/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div ref={containerRef} className="h-[420px] w-full select-none overflow-hidden rounded-xl border" />

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Click a place on the map to add it. Zoom in to pick regions and cities.
        </p>
        <Button
          type="button"
          className="cursor-pointer"
          disabled={places.length === 0}
          onClick={() => onApply({ labels: places.map((p) => p.label) })}
        >
          Use these places
        </Button>
      </div>
    </div>
  );
}
