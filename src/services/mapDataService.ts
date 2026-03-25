/**
 * Unified service to fetch both parking spots and public areas in a single Overpass API request.
 */

export interface ParkingPoint {
  id: number;
  lat: number;
  lon: number;
  name: string;
}

export interface PublicArea {
  id: number;
  type: "way" | "relation";
  coordinates: [number, number][];
  name?: string;
  tags: Record<string, string>;
}

export interface MapDataResult {
  parkingSpots: ParkingPoint[];
  publicAreas: PublicArea[];
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
  options: { parking: boolean; publicAreas: boolean },
  signal?: AbortSignal
): Promise<MapDataResult> {
  if (!options.parking && !options.publicAreas) {
    return { parkingSpots: [], publicAreas: [] };
  }

  // Build a combined query
  let subQueries = "";
  if (options.parking) {
    subQueries += `
      node["amenity"="parking"](around:${radius}, ${lat}, ${lon});
      way["amenity"="parking"](around:${radius}, ${lat}, ${lon});
    `;
  }
  if (options.publicAreas) {
    subQueries += `
      way["leisure"~"park|nature_reserve|recreation_ground"](around:${radius}, ${lat}, ${lon});
      relation["leisure"~"park|nature_reserve|recreation_ground"](around:${radius}, ${lat}, ${lon});
      way["landuse"~"forest|village_green|recreation_ground"](around:${radius}, ${lat}, ${lon});
      relation["landuse"~"forest|village_green|recreation_ground"](around:${radius}, ${lat}, ${lon});
    `;
  }

  const query = `
    [out:json][timeout:30];
    (
      ${subQueries}
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
        if (!data.elements) return { parkingSpots: [], publicAreas: [] };

        const parkingSpots: ParkingPoint[] = [];
        const publicAreas: PublicArea[] = [];

        data.elements.forEach((el: any) => {
          const isParking = el.tags?.amenity === 'parking';

          if (isParking) {
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
          } else {
            // It's a public area
            const coords: [number, number][] = el.geometry
              ? el.geometry.map((pt: any) => [pt.lat, pt.lon])
              : [];

            if (coords.length > 0) {
              publicAreas.push({
                id: el.id,
                type: el.type,
                coordinates: coords,
                name: el.tags?.name,
                tags: el.tags || {}
              });
            }
          }
        });

        return { parkingSpots, publicAreas };

      } catch (fetchErr) {
        if (signal) signal.removeEventListener('abort', onAbort);
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError' && signal?.aborted) throw err;
      lastError = err as Error;
      continue;
    }
  }

  throw lastError || new Error("All Overpass API instances failed.");
}
