import { useEffect, useRef, useState } from "react";
import { Check, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export type CityValue = {
  label: string; // "Berlin, Germany"
  city: string;
  country: string;
};

type Props = {
  id?: string;
  value: CityValue | null;
  onChange: (v: CityValue | null) => void;
  placeholder?: string;
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
  };
};

export function CitySearch({ id, value, onChange, placeholder = "Start typing a city…" }: Props) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<CityValue[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync internal query when the value prop changes externally
  // (e.g. when the user clicks "Use my current location").
  useEffect(() => {
    if (value && value.label !== query) {
      setQuery(value.label);
      setOpen(false);
      setResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.label]);

  useEffect(() => {
    if (value && query === value.label) return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&featuretype=city&accept-language=en&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { Accept: "application/json", "Accept-Language": "en" },
        });
        const data: NominatimResult[] = await res.json();
        const cities: CityValue[] = [];
        const seen = new Set<string>();
        for (const r of data) {
          const a = r.address ?? {};
          const city = a.city || a.town || a.village || a.municipality;
          const country = a.country;
          if (!city || !country) continue;
          const label = `${city}, ${country}`;
          if (seen.has(label)) continue;
          seen.add(label);
          cities.push({ label, city, country });
        }
        setResults(cities);
      } catch {
        // ignore aborts/errors
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, value]);

  const select = (c: CityValue) => {
    onChange(c);
    setQuery(c.label);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={query}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value && e.target.value !== value.label) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        className="mt-1"
      />
      {open && (query.trim().length >= 2) && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {loading && (
            <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-2 py-2 text-sm text-muted-foreground">No matches</div>
          )}
          {results.map((c) => {
            const selected = value?.label === c.label;
            return (
              <button
                type="button"
                key={c.label}
                onClick={() => select(c)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  selected && "bg-accent",
                )}
              >
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">{c.label}</span>
                {selected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
