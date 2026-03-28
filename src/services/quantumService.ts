/**
 * Logic for calculating attractors using local CSPRNG and Silverman KDE.
 */

export interface Point {
  lat: number;
  lon: number;
}

export interface AttractorResult {
  lat: number;
  lon: number;
  densityScore: number;
  points: number;
  radius: number;
  googleMapsUrl: string;
}

export type IntentionType =
  | 'explore'
  | 'routine'
  | 'synchronicity'
  | 'anomaly'
  | 'attractor'
  | 'repeller'
  | 'planeshifting'
  | 'trial'
  | 'quest';

interface IntentionConfig {
  pointCount: number;
  // 'max' | 'min' | percentile fraction 0–1
  kdeSelector: 'max' | 'min' | number;
}

const INTENTION_CONFIGS: Record<IntentionType, IntentionConfig> = {
  explore:       { pointCount: 512,  kdeSelector: 0.50 },
  routine:       { pointCount: 256,  kdeSelector: 0.75 },
  synchronicity: { pointCount: 1024, kdeSelector: 'max' },
  anomaly:       { pointCount: 512,  kdeSelector: 0.85 },
  attractor:     { pointCount: 1024, kdeSelector: 'max' },
  repeller:      { pointCount: 512,  kdeSelector: 'min' },
  planeshifting: { pointCount: 256,  kdeSelector: 0.25 },
  trial:         { pointCount: 512,  kdeSelector: 0.90 },
  quest:         { pointCount: 768,  kdeSelector: 0.60 },
};

const EARTH_RADIUS = 6371; // km
const ONE_DEGREE = (EARTH_RADIUS * 2 * Math.PI) / 360 * 1000;

/**
 * Generates random numbers using the browser's native CSPRNG.
 * length should be at least pointCount * 2 for the chosen intention.
 */
export async function fetchQuantumNumbers(length: number = 2048): Promise<number[]> {
  const array = new Uint16Array(length);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array);
}

/**
 * Calculates the attractor point based on start position, radius, and intention.
 */
export function calculateAttractor(
  startLat: number,
  startLon: number,
  radius: number,
  quantumNumbers: number[],
  intention: IntentionType = 'attractor'
): AttractorResult {
  if (!quantumNumbers || quantumNumbers.length === 0) {
    throw new Error("No quantum numbers provided");
  }

  const config = INTENTION_CONFIGS[intention];
  const pointCount = config.pointCount;

  // --- STEP A: Generate random points ---
  const coordList: Point[] = [];
  for (let i = 0; i < quantumNumbers.length && coordList.length < pointCount; i += 2) {
    if (i + 1 >= quantumNumbers.length) break;

    const randFloat1 = quantumNumbers[i] / 65535.0;
    const randFloat2 = quantumNumbers[i + 1] / 65535.0;

    const rLen = radius * Math.sqrt(randFloat1);
    const theta = randFloat2 * 2 * Math.PI;

    const dX = rLen * Math.cos(theta);
    const dY = rLen * Math.sin(theta);

    const randomLat = startLat + dY / ONE_DEGREE;
    const randomLon = startLon + dX / (ONE_DEGREE * Math.cos((startLat * Math.PI) / 180));

    coordList.push({ lat: randomLat, lon: randomLon });
  }

  const n = coordList.length;

  // --- STEP B: Silverman KDE Estimation ---
  let meanLat = 0, meanLon = 0;
  for (const p of coordList) {
    meanLat += p.lat;
    meanLon += p.lon;
  }
  meanLat /= n;
  meanLon /= n;

  let stdLat = 0, stdLon = 0;
  for (const p of coordList) {
    stdLat += Math.pow(p.lat - meanLat, 2);
    stdLon += Math.pow(p.lon - meanLon, 2);
  }
  stdLat = Math.sqrt(stdLat / n);
  stdLon = Math.sqrt(stdLon / n);

  let bwLat = Math.pow(n, -1 / 6) * stdLat;
  let bwLon = Math.pow(n, -1 / 6) * stdLon;

  bwLat = Math.max(bwLat, 0.000001);
  bwLon = Math.max(bwLon, 0.000001);

  let minLat = coordList[0].lat, maxLat = coordList[0].lat;
  let minLon = coordList[0].lon, maxLon = coordList[0].lon;
  for (const p of coordList) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }

  // --- STEP C: Build full KDE density grid (100x100) ---
  const gridDensities: { lat: number; lon: number; density: number }[] = [];

  for (let i = 0; i < 100; i++) {
    const gridLat = minLat + ((maxLat - minLat) * i) / 99;
    for (let j = 0; j < 100; j++) {
      const gridLon = minLon + ((maxLon - minLon) * j) / 99;

      let density = 0;
      for (const p of coordList) {
        const u = (gridLat - p.lat) / bwLat;
        const v = (gridLon - p.lon) / bwLon;
        density += Math.exp(-0.5 * (u * u + v * v));
      }
      gridDensities.push({ lat: gridLat, lon: gridLon, density });
    }
  }

  // --- STEP D: Select grid cell based on intention ---
  gridDensities.sort((a, b) => a.density - b.density);

  let selected: { lat: number; lon: number; density: number };

  const sel = config.kdeSelector;
  if (sel === 'max') {
    selected = gridDensities[gridDensities.length - 1];
  } else if (sel === 'min') {
    selected = gridDensities[0];
  } else {
    const idx = Math.round(sel * (gridDensities.length - 1));
    selected = gridDensities[Math.min(idx, gridDensities.length - 1)];
  }

  return {
    lat: selected.lat,
    lon: selected.lon,
    densityScore: selected.density,
    points: n,
    radius: radius,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lon}`,
  };
}
