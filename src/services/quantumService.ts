/**
 * Logic for calculating quantum attractors using ANU QRNG API and Silverman KDE.
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

const EARTH_RADIUS = 6371; // km
const ONE_DEGREE = (EARTH_RADIUS * 2 * Math.PI) / 360 * 1000;

/**
 * Fetches quantum random numbers from ANU API.
 */
export async function fetchQuantumNumbers(length: number = 1024): Promise<number[]> {
  const response = await fetch(`https://qrng.anu.edu.au/API/jsonI.php?length=${length}&type=uint16`);
  if (!response.ok) {
    throw new Error("Failed to fetch quantum numbers from ANU API");
  }
  const data = await response.json();
  return data.data;
}

/**
 * Calculates the attractor point based on start position and radius.
 */
export function calculateAttractor(
  startLat: number,
  startLon: number,
  radius: number,
  quantumNumbers: number[]
): AttractorResult {
  if (!quantumNumbers || quantumNumbers.length === 0) {
    throw new Error("No quantum numbers provided");
  }

  // --- STEP A: Generate 512 random points (Attractors) ---
  const coordList: Point[] = [];
  for (let i = 0; i < quantumNumbers.length; i += 2) {
    if (i + 1 >= quantumNumbers.length) break;

    // Convert integers (0-65535) to percentages (0.0 - 1.0)
    const randFloat1 = quantumNumbers[i] / 65535.0;
    const randFloat2 = quantumNumbers[i + 1] / 65535.0;

    // Geometry: Random radius and angle θ
    const rLen = radius * Math.sqrt(randFloat1);
    const theta = randFloat2 * 2 * Math.PI;

    // Offsets in meters
    const dX = rLen * Math.cos(theta);
    const dY = rLen * Math.sin(theta);

    // New coordinates relative to center
    const randomLat = startLat + dY / ONE_DEGREE;
    const randomLon = startLon + dX / (ONE_DEGREE * Math.cos((startLat * Math.PI) / 180));

    coordList.push({ lat: randomLat, lon: randomLon });
  }

  // --- STEP B: Silverman KDE Estimation ---
  const n = coordList.length;

  // Means
  let meanLat = 0, meanLon = 0;
  for (const p of coordList) {
    meanLat += p.lat;
    meanLon += p.lon;
  }
  meanLat /= n;
  meanLon /= n;

  // Standard deviations
  let stdLat = 0, stdLon = 0;
  for (const p of coordList) {
    stdLat += Math.pow(p.lat - meanLat, 2);
    stdLon += Math.pow(p.lon - meanLon, 2);
  }
  stdLat = Math.sqrt(stdLat / n);
  stdLon = Math.sqrt(stdLon / n);

  // Silverman bandwidth (h)
  let bwLat = Math.pow(n, -1 / 6) * stdLat;
  let bwLon = Math.pow(n, -1 / 6) * stdLon;

  // Prevent division by zero
  bwLat = Math.max(bwLat, 0.000001);
  bwLon = Math.max(bwLon, 0.000001);

  // Bounding box
  let minLat = coordList[0].lat, maxLat = coordList[0].lat;
  let minLon = coordList[0].lon, maxLon = coordList[0].lon;
  for (const p of coordList) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }

  // --- STEP C: Search for highest density point ---
  let maxDensity = -1;
  let attractor = { lat: startLat, lon: startLon, densityScore: 0 };

  // Scan 100x100 grid
  for (let i = 0; i < 100; i++) {
    const gridLat = minLat + ((maxLat - minLat) * i) / 99;
    for (let j = 0; j < 100; j++) {
      const gridLon = minLon + ((maxLon - minLon) * j) / 99;

      let density = 0;
      for (const p of coordList) {
        const u = (gridLat - p.lat) / bwLat;
        const v = (gridLon - p.lon) / bwLon;
        // Gaussian Kernel
        density += Math.exp(-0.5 * (u * u + v * v));
      }

      if (density > maxDensity) {
        maxDensity = density;
        attractor = { lat: gridLat, lon: gridLon, densityScore: density };
      }
    }
  }

  return {
    lat: attractor.lat,
    lon: attractor.lon,
    densityScore: attractor.densityScore,
    points: n,
    radius: radius,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${attractor.lat},${attractor.lon}`,
  };
}
