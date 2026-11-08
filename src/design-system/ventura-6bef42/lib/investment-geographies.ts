export interface InvestmentGeographyPreset {
  label: string;
  queries: string[];
}

export const INVESTMENT_GEOGRAPHY_PRESETS: InvestmentGeographyPreset[] = [
  {
    label: "Nordics",
    queries: ["Denmark", "Finland", "Iceland", "Norway", "Sweden"],
  },
  {
    label: "Baltics",
    queries: ["Estonia", "Latvia", "Lithuania"],
  },
  {
    label: "DACH",
    queries: ["Austria", "Germany", "Switzerland"],
  },
  {
    label: "Europe",
    queries: ["Europe"],
  },
  {
    label: "North America",
    queries: ["North America"],
  },
];

export function getInvestmentGeographyPreset(label: string) {
  return INVESTMENT_GEOGRAPHY_PRESETS.find((preset) => preset.label === label);
}