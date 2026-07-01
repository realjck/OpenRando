/**
 * Service to fetch nearby parking spots from the Overpass API.
 */

export interface ParkingPoint {
  id: number;
  lat: number;
  lon: number;
  name: string;
}

const OVERPASS_INSTANCES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter"
];

export async function fetchMapData(
  lat: number,
  lon: number,
  radius: number,
  signal?: AbortSignal
): Promise<ParkingPoint[]> {
  const query = `
    [out:json][timeout:30];
    (
      node["amenity"="parking"](around:${radius}, ${lat}, ${lon});
      way["amenity"="parking"](around:${radius}, ${lat}, ${lon});
    );
    out geom;
  `;

  let lastError: Error | null = null;

  for (const url of OVERPASS_INSTANCES) {
    if (signal?.aborted) throw new Error("AbortError");

    try {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 10000);

      const onAbort = () => timeoutController.abort();
      if (signal) signal.addEventListener('abort', onAbort);

      try {
        const response = await fetch(url, {
          method: "POST",
          body: query,
          signal: timeoutController.signal
        });

        if (signal) signal.removeEventListener('abort', onAbort);
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429 || response.status >= 500) continue;
          throw new Error(`Failed to fetch map data: ${response.status}`);
        }

        const data = await response.json();
        if (!data.elements) return [];

        const parkingSpots: ParkingPoint[] = [];

        data.elements.forEach((el: any) => {
          // For parking, we want a single point (center)
          let pLat, pLon;
          if (el.type === 'node') {
            pLat = el.lat;
            pLon = el.lon;
          } else if (el.geometry) {
            // Calculate center of the way/area
            pLat = el.geometry.reduce((sum: number, pt: any) => sum + pt.lat, 0) / el.geometry.length;
            pLon = el.geometry.reduce((sum: number, pt: any) => sum + pt.lon, 0) / el.geometry.length;
          } else {
            return;
          }

          parkingSpots.push({
            id: el.id,
            lat: pLat,
            lon: pLon,
            name: el.tags?.name || "Parking"
          });
        });

        return parkingSpots;

      } catch (error_) {
        if (signal) signal.removeEventListener('abort', onAbort);
        clearTimeout(timeoutId);
        throw error_;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError' && signal?.aborted) throw err;
      lastError = err as Error;
      continue;
    }
  }

  throw lastError || new Error("All Overpass API instances failed.");
}
