import { useState, useEffect, memo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation,
  Compass,
  ExternalLink,
  RefreshCw,
  Settings2,
  LocateFixed,
  Info,
  X,
  Car,
  Trees
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchQuantumNumbers, calculateAttractor, AttractorResult } from './services/quantumService';
import { fetchMapData, ParkingPoint, PublicArea } from './services/mapDataService';

// Fix Leaflet marker icon issues
const startIcon = L.divIcon({
  html: `<div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
          <div class="w-2 h-2 bg-white rounded-full"></div>
        </div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const attractorIcon = L.divIcon({
  html: `<div class="w-8 h-8 bg-purple-600 rounded-full border-2 border-white shadow-xl flex items-center justify-center animate-pulse">
          <div class="w-3 h-3 bg-white rounded-full"></div>
        </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const parkingIcon = L.divIcon({
  html: `<div class="w-6 h-6 bg-zinc-800 rounded-lg border border-white/20 shadow-md flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>
        </div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

// Component to handle map center updates
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Component to handle map clicks for manual coordinate entry
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const RadiusSlider = memo(function RadiusSlider({
  radius,
  setRadius,
  setFetchRadius
}: {
  radius: number,
  setRadius: (val: number) => void,
  setFetchRadius: (val: number) => void
}) {
  return (
    <input
      type="range"
      min="500"
      max="5000"
      step="100"
      value={radius}
      onChange={(e) => setRadius(Number.parseInt(e.target.value))}
      onMouseUp={() => setFetchRadius(radius)}
      onTouchEnd={() => setFetchRadius(radius)}
      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500 mb-6"
    />
  );
});

export default function App() {
  const [startPos, setStartPos] = useState<[number, number]>([48.8566, 2.3522]); // Default Paris
  const [radius, setRadius] = useState(1000);
  const [fetchRadius, setFetchRadius] = useState(1000);
  const [attractor, setAttractor] = useState<AttractorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Map data state (Parking & Public Areas)
  const [showParking, setShowParking] = useState(false);
  const [showPublicAreas, setShowPublicAreas] = useState(false);
  const [parkingSpots, setParkingSpots] = useState<ParkingPoint[]>([]);
  const [publicAreas, setPublicAreas] = useState<PublicArea[]>([]);
  const [loadingMapData, setLoadingMapData] = useState(false);

  // Cache and tracking for optimization
  const lastFetchRef = useRef<{ pos: [number, number], radius: number, time: number, options: string } | null>(null);
  const mapDataCache = useRef<Record<string, { parkingSpots: ParkingPoint[], publicAreas: PublicArea[] }>>({});
  const mapDataAbortControllerRef = useRef<AbortController | null>(null);

  // Get user location on mount
  useEffect(() => {
    handleGetCurrentLocation();
  }, []);

  // Helper to calculate distance in meters between two points
  const getDistance = (p1: [number, number], p2: [number, number]) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = p1[0] * Math.PI / 180;
    const φ2 = p2[0] * Math.PI / 180;
    const Δφ = (p2[0] - p1[0]) * Math.PI / 180;
    const Δλ = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Debounced fetch for map data (Parking & Public Areas)
  useEffect(() => {
    if (!showParking && !showPublicAreas) {
      setParkingSpots([]);
      setPublicAreas([]);
      if (mapDataAbortControllerRef.current) {
        mapDataAbortControllerRef.current.abort();
        mapDataAbortControllerRef.current = null;
      }
      setLoadingMapData(false);
      return;
    }

    const timer = setTimeout(() => {
      // Optimization: Only fetch if moved significantly or radius changed
      // Threshold: 10% of radius or 50 meters, whichever is smaller
      const threshold = Math.min(radius * 0.1, 50);
      const now = Date.now();
      const optionsKey = `${showParking}-${showPublicAreas}`;

      if (lastFetchRef.current) {
        const dist = getDistance(startPos, lastFetchRef.current.pos);
        const radiusDiff = Math.abs(fetchRadius - lastFetchRef.current.radius);
        const timeDiff = now - lastFetchRef.current.time;
        const optionsChanged = optionsKey !== lastFetchRef.current.options;

        // If moved very little and radius is same, and options same, skip
        if (dist < threshold && radiusDiff < 10 && !optionsChanged) {
          return;
        }

        // Rate limit: Don't fetch more than once every 3 seconds
        if (timeDiff < 3000 && !optionsChanged) {
          return;
        }
      }

      handleFetchMapData(fetchRadius);
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [showParking, showPublicAreas, startPos, fetchRadius, radius]);

  useEffect(() => {
    if (error && error.includes("rate limit")) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleFetchMapData = async (currentRadius: number) => {
    const optionsKey = `${showParking}-${showPublicAreas}`;
    const cacheKey = `${startPos[0].toFixed(4)},${startPos[1].toFixed(4)},${currentRadius},${optionsKey}`;
    const now = Date.now();

    if (mapDataCache.current[cacheKey]) {
      const cached = mapDataCache.current[cacheKey];
      setParkingSpots(cached.parkingSpots);
      setPublicAreas(cached.publicAreas);
      lastFetchRef.current = { pos: startPos, radius: currentRadius, time: now, options: optionsKey };
      return;
    }

    setLoadingMapData(true);

    if (mapDataAbortControllerRef.current) {
      mapDataAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    mapDataAbortControllerRef.current = controller;

    try {
      const result = await fetchMapData(
        startPos[0],
        startPos[1],
        currentRadius,
        { parking: showParking, publicAreas: showPublicAreas },
        controller.signal
      );

      setParkingSpots(result.parkingSpots);
      setPublicAreas(result.publicAreas);
      mapDataCache.current[cacheKey] = result;
      lastFetchRef.current = { pos: startPos, radius: currentRadius, time: now, options: optionsKey };
    } catch (err) {
      // Only return if the user aborted the request
      if (err instanceof Error && err.name === 'AbortError' && controller.signal.aborted) return;

      console.error("Map data fetch error:", err);

      // Fatal error: deactivate toggles and show message
      setShowParking(false);
      setShowPublicAreas(false);
      setError("The data servers are currently overloaded. Please try again in a few moments.");

      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoadingMapData(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setStartPos([position.coords.latitude, position.coords.longitude]);
          setError(null);
        },
        (err) => {
          console.error("Geolocation error:", err);
          setError("Unable to access your location. Check permissions.");
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const quantumNumbers = await fetchQuantumNumbers();
      const result = calculateAttractor(startPos[0], startPos[1], radius, quantumNumbers);
      setAttractor(result);
    } catch (err) {
      console.error("Generation error:", err);
      setError("Error during generation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (lat: number, lon: number) => {
    setStartPos([lat, lon]);
    setAttractor(null);
  };

  return (
    <div className="relative h-[100dvh] w-screen flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-[1000] p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/20">
            <Compass className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">OpenRando</h1>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white pointer-events-auto border border-white/10"
        >
          <Info className="w-5 h-5" />
        </button>
      </header>

      {/* Map Container */}
      <div className="flex-1 relative">
        <MapContainer
          center={startPos}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <MapController center={startPos} />
          <MapClickHandler onMapClick={handleMapClick} />

          <Marker position={startPos} icon={startIcon} />

          <Circle
            center={startPos}
            radius={radius}
            pathOptions={{ color: '#8b5cf6', weight: 1, fillColor: '#8b5cf6', fillOpacity: 0.1 }}
          />

          {attractor && (
            <Marker position={[attractor.lat, attractor.lon]} icon={attractorIcon} />
          )}

          {showParking && parkingSpots.map(spot => (
            <Marker key={spot.id} position={[spot.lat, spot.lon]} icon={parkingIcon}>
              <Popup>
                <div className="p-1">
                  <div className="text-black font-bold mb-2">{spot.name}</div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 !text-white text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors no-underline"
                  >
                    <Navigation className="w-3 h-3 text-white" />
                    <span className="text-white">Maps</span>
                    <ExternalLink className="w-2.5 h-2.5 text-white" />
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}

          {showPublicAreas && publicAreas.map(area => (
            <Polygon
              key={area.id}
              positions={area.coordinates}
              pathOptions={{
                color: '#22c55e',
                weight: 1,
                fillColor: '#22c55e',
                fillOpacity: 0.25
              }}
            >
              <Popup>
                <div className="p-1">
                  <div className="text-black font-bold">{area.name || "Public Space"}</div>
                  <div className="text-[10px] text-zinc-500 mb-2">{area.tags.leisure || area.tags.landuse || "Area"}</div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${area.coordinates[0][0]},${area.coordinates[0][1]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 !text-white text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors no-underline"
                  >
                    <Navigation className="w-3 h-3 text-white" />
                    <span className="text-white">Maps</span>
                    <ExternalLink className="w-2.5 h-2.5 text-white" />
                  </a>
                </div>
              </Popup>
            </Polygon>
          ))}
        </MapContainer>

        {/* Floating Action Buttons */}
        <div className="absolute right-4 top-24 z-[1000] flex flex-col gap-3">
          <button
            onClick={handleGetCurrentLocation}
            className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 shadow-lg active:scale-95 transition-transform"
            title="My position"
          >
            <LocateFixed className="w-6 h-6" />
          </button>

          <button
            onClick={() => setShowParking(!showParking)}
            className={`w-12 h-12 backdrop-blur-md rounded-full flex items-center justify-center border shadow-lg active:scale-95 transition-all cursor-pointer ${showParking
              ? 'bg-blue-600 text-white border-blue-400'
              : 'bg-white/10 text-white border-white/10'
              }`}
            title="Show parking"
          >
            {loadingMapData && showParking ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <Car className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={() => setShowPublicAreas(!showPublicAreas)}
            className={`w-12 h-12 backdrop-blur-md rounded-full flex items-center justify-center border shadow-lg active:scale-95 transition-all cursor-pointer ${showPublicAreas
              ? 'bg-green-600 text-white border-green-400'
              : 'bg-white/10 text-white border-white/10'
              }`}
            title="Show public areas"
          >
            {loadingMapData && showPublicAreas ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <Trees className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] p-4 pointer-events-none">
        <div className="max-w-md mx-auto space-y-4">
          <AnimatePresence>
            {attractor && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="bg-zinc-900/90 backdrop-blur-xl p-4 rounded-2xl border border-purple-500/30 shadow-2xl pointer-events-auto"
              >
                <div className="flex items-center justify-between mb-4 bg-black/40 p-2.5 rounded-xl border border-white/5 gap-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400 truncate">Destination Found</span>
                    <div className="text-xs sm:text-sm text-zinc-300 flex items-center flex-wrap gap-1">
                      <span className="font-bold text-white">Quantum Attractor :</span>
                      <span className="font-mono">{attractor.lat.toFixed(5)}, {attractor.lon.toFixed(5)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="bg-purple-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono text-purple-300 border border-purple-500/30">
                      ★ {attractor.densityScore.toFixed(2)}
                    </div>
                    <button
                      onClick={() => setAttractor(null)}
                      className="w-6 h-6 flex items-center justify-center bg-black/20 hover:bg-black/40 rounded-full text-zinc-400 hover:text-white transition-colors border border-white/5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <a
                  href={attractor.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-purple-900/20"
                >
                  <Navigation className="w-5 h-5" />
                  Open in Maps
                  <ExternalLink className="w-4 h-4" />
                </a>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-zinc-900/90 backdrop-blur-xl p-5 rounded-3xl border border-white/10 shadow-2xl pointer-events-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-300">Search radius</span>
              </div>
              <span className="text-sm font-bold text-purple-400">{radius}m</span>
            </div>

            <RadiusSlider radius={radius} setRadius={setRadius} setFetchRadius={setFetchRadius} />

            <button
              onClick={handleGenerate}
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${loading
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-white text-black hover:bg-zinc-200 active:scale-[0.98]'
                }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-6 h-6" />
                  Generate Attractor
                </>
              )}
            </button>

            {error && (
              <p className="mt-3 text-center text-xs text-red-400 font-medium">{error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 p-6 rounded-3xl max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-white mb-4">About OpenRando</h2>
              <div className="space-y-4 text-zinc-400 text-sm leading-relaxed">
                <p>
                  OpenRando uses your device's native Cryptographically Secure Random Number Generator to create unique destination points.
                </p>
                <p>
                  The principle is to break your daily routine by sending you to areas of high "vibration", calculated by a Kernel Density Estimation (KDE) on 512 points.
                </p>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <p className="text-xs font-bold text-purple-400 uppercase mb-1">How to use:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Set your starting point (click on map or GPS).</li>
                    <li>Choose a radius (500m to 5km).</li>
                    <li>Generate your attractor.</li>
                    <li>Go on an adventure!</li>
                  </ul>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <a
                  href="https://github.com/realjck/OpenRando"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium rounded-xl transition-colors border border-white/10"
                >
                  <GithubIcon className="w-5 h-5" />
                  View on GitHub
                </a>
                <button
                  onClick={() => setShowInfo(false)}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
