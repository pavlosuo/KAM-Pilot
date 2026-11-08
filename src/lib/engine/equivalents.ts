/**
 * Everyday comparisons for the Recap ("the water 7 Finnish families use in a
 * year"). Each factor is a published average with its source; results are
 * rounded, labelled "about" and never used in calculations or exports of
 * the review figures themselves.
 */

export interface Factor {
  value: number;
  unit: string;
  source: string;
  url: string;
}

/** Household water use per person and day. */
export const WATER_PER_PERSON_DAY: Record<string, Factor> = {
  Finland: {
    value: 130,
    unit: "L / person / day",
    source: "Finnish Environment Institute (vesi.fi): the average Finn uses around 130 litres a day",
    url: "https://www.vesi.fi/en/water-topics/history-of-tap-water/",
  },
};
export const WATER_PER_PERSON_DAY_EUROPE: Factor = {
  value: 125,
  unit: "L / person / day",
  source: "EurEau, Europe's Water in Figures: most European countries use 78–150 litres per person a day (midpoint used)",
  url: "https://smartwatermagazine.com/news/locken/water-ranking-europe-2020",
};

/** Household electricity per dwelling and year. */
export const HOME_ELECTRICITY: Record<string, Factor> = {
  Sweden: {
    value: 8_500,
    unit: "kWh / dwelling / year",
    source: "ODYSSEE-MURE: electricity consumption per dwelling, Sweden 8.5 MWh",
    url: "https://www.odyssee-mure.eu/publications/efficiency-by-sector/households/electricity-consumption-dwelling.html",
  },
};
export const HOME_ELECTRICITY_EU: Factor = {
  value: 3_600,
  unit: "kWh / dwelling / year",
  source: "ODYSSEE-MURE: EU average electricity consumption per dwelling 3.6 MWh",
  url: "https://www.odyssee-mure.eu/publications/efficiency-by-sector/households/electricity-consumption-dwelling.html",
};

export const CAR_CO2_PER_KM: Factor = {
  value: 0.1066,
  unit: "kg CO₂ / km",
  source: "European Environment Agency: average new passenger car registered in Europe in 2023, 106.6 g CO₂/km",
  url: "https://www.eea.europa.eu/en/newsroom/news/new-data-co2-emissions-of-new-cars-and-vans",
};

export const EARTH_CIRCUMFERENCE_KM = 40_075;
export const FAMILY_SIZE = 4;
export const BATHTUB_L = 150;
/** Working days used to express yearly totals "per working day". */
export const WORKING_DAYS_PER_MONTH = 21;

const round = (v: number) => (v >= 100 ? Math.round(v / 10) * 10 : v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);

export interface WaterEquivalent {
  families: number;
  bathtubs: number;
  country: string | null;
  factor: Factor;
}

/** Litres → families of four for a year in the person's country (Europe-wide average elsewhere). */
export function waterEquivalent(litres: number, country?: string | null): WaterEquivalent {
  const local = country ? WATER_PER_PERSON_DAY[country] : undefined;
  const factor = local ?? WATER_PER_PERSON_DAY_EUROPE;
  const perFamilyYear = factor.value * 365 * FAMILY_SIZE;
  return { families: Math.max(0, litres / perFamilyYear), bathtubs: Math.max(0, litres / BATHTUB_L), country: local ? country! : null, factor };
}

export interface EnergyEquivalent {
  homes: number;
  country: string | null;
  factor: Factor;
}

export function energyEquivalent(kwh: number, country?: string | null): EnergyEquivalent {
  const local = country ? HOME_ELECTRICITY[country] : undefined;
  const factor = local ?? HOME_ELECTRICITY_EU;
  return { homes: Math.max(0, kwh / factor.value), country: local ? country! : null, factor };
}

export interface CarEquivalent {
  km: number;
  earthLaps: number;
  factor: Factor;
}

export function carEquivalent(co2Kg: number): CarEquivalent {
  const km = Math.max(0, co2Kg / CAR_CO2_PER_KM.value);
  return { km, earthLaps: km / EARTH_CIRCUMFERENCE_KM, factor: CAR_CO2_PER_KM };
}

export function perWorkingDay(total: number, months: number): number {
  return total / Math.max(1, months * WORKING_DAYS_PER_MONTH);
}

/** "about 7", "about 60", "1.4 million" - rounded for speech, never for calculation. */
export function aboutNumber(v: number): string {
  if (v < 1) return "less than one";
  if (v >= 1e6) return `${(Math.round(v / 1e5) / 10).toLocaleString("en-US")} million`;
  if (v >= 1e4) return (Math.round(v / 1000) * 1000).toLocaleString("en-US");
  return round(v).toLocaleString("en-US");
}

/** Whole things (families, homes, days): never "3.9 families". */
export function aboutCount(v: number): string {
  if (v < 1) return "less than one";
  if (v >= 1e4) return aboutNumber(v);
  return (v >= 100 ? Math.round(v / 10) * 10 : Math.round(v)).toLocaleString("en-US");
}

/** People's yearly household water use, for amounts too small to fill a family's year. */
export function waterPeople(litres: number, factor: Factor): number {
  return Math.max(0, litres / (factor.value * 365));
}

/** Demonym used in comparisons ("Finnish families"); falls back to "European". */
export function demonym(country: string | null): string {
  const map: Record<string, string> = {
    Finland: "Finnish",
    Sweden: "Swedish",
    Poland: "Polish",
    Norway: "Norwegian",
    Denmark: "Danish",
    Estonia: "Estonian",
    Latvia: "Latvian",
    Lithuania: "Lithuanian",
    Germany: "German",
  };
  return (country && map[country]) || "European";
}
