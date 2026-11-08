/**
 * Approximate city-centre coordinates (public geography) used only to place
 * sites on the map. Not part of the data pack; production would use the
 * delivery address from eLindström.
 */
export const CITY_COORDS: Record<string, [number, number]> = {
  Helsinki: [24.94, 60.17],
  Turku: [22.27, 60.45],
  Tampere: [23.76, 61.5],
  Oulu: [25.47, 65.01],
  Lahti: [25.66, 60.98],
  Kuopio: [27.68, 62.89],
  Vaasa: [21.62, 63.1],
  Pori: [21.8, 61.49],
  Jyväskylä: [25.75, 62.24],
  Kotka: [26.95, 60.47],
  Lappeenranta: [28.19, 61.06],
  Seinäjoki: [22.84, 62.79],
  Malmö: [13.0, 55.6],
  Gothenburg: [11.97, 57.71],
  Stockholm: [18.07, 59.33],
  Uppsala: [17.64, 59.86],
  Örebro: [15.21, 59.27],
  Västerås: [16.54, 59.61],
  Warsaw: [21.01, 52.23],
  Poznań: [16.93, 52.41],
  Wrocław: [17.04, 51.11],
  Gdańsk: [18.65, 54.35],
  Kraków: [19.94, 50.06],
  Łódź: [19.46, 51.76],
};

export function cityCoord(city: string): [number, number] | null {
  return CITY_COORDS[city] ?? null;
}
