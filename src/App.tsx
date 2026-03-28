import { useState, useEffect, memo, useRef, type ComponentType, type CSSProperties } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation,
  Compass,
  ExternalLink,
  RefreshCw,
  LocateFixed,
  Info,
  X,
  Car,
  Trees,
  Sparkles,
  ScanEye,
  MapPinPlus,
  CircleOff,
  Globe,
  ShieldAlert,
  GitBranch,
  RefreshCcwDot,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchQuantumNumbers, calculateAttractor, AttractorResult, IntentionType } from './services/quantumService';
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

// --- Intentions ---
type IntentionMeta = {
  id: IntentionType;
  name: string;
  Icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color: string;
  description: string;
};

const INTENTIONS: IntentionMeta[] = [
  {
    id: 'explore',
    name: 'Explore the Unknown',
    Icon: Compass,
    color: '#6366f1',
    description: 'Represents venturing into uncharted territory, outside probability tunnels.',
  },
  {
    id: 'routine',
    name: 'Break the Routine',
    Icon: RefreshCcwDot,
    color: '#f97316',
    description: 'Symbolizes disruption of the deterministic flow and introducing change.',
  },
  {
    id: 'synchronicity',
    name: 'Synchronicity',
    Icon: Sparkles,
    color: '#a855f7',
    description: 'Reflects the noosphere / Genesis Field concept, mind influencing randomness.',
  },
  {
    id: 'anomaly',
    name: 'The Anomaly',
    Icon: ScanEye,
    color: '#14b8a6',
    description: 'Focuses on heightened perception to notice coincidences and void-meme signals.',
  },
  {
    id: 'attractor',
    name: 'Attractor',
    Icon: MapPinPlus,
    color: '#8b5cf6',
    description: 'Points to dense clusters of random points, a magnetic spot of probability.',
  },
  {
    id: 'repeller',
    name: 'Repeller',
    Icon: CircleOff,
    color: '#ef4444',
    description: 'Represents areas avoided by randomness, the blind spots of the Genesis Field.',
  },
  {
    id: 'planeshifting',
    name: 'Planeshifting',
    Icon: Globe,
    color: '#22d3ee',
    description: 'Suggests moving between reality tunnels and parallel timelines.',
  },
  {
    id: 'trial',
    name: 'The Trial',
    Icon: ShieldAlert,
    color: '#f59e0b',
    description: 'Aligns with the Despair meme, confronting memetic danger and stasis field pressure.',
  },
  {
    id: 'quest',
    name: 'The Quest',
    Icon: GitBranch,
    color: '#84cc16',
    description: 'Represents a chain of points, creating an unusual route rather than a single destination.',
  },
];

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
  const [selectedIntention, setSelectedIntention] = useState<IntentionType>('attractor');
  const [showIntentionModal, setShowIntentionModal] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<{ id: IntentionType; top: number; right: number } | null>(null);

  // Map data state (Parking & Public Areas)
  const [showParking, setShowParking] = useState(false);
  const [showPublicAreas, setShowPublicAreas] = useState(false);
  const [parkingSpots, setParkingSpots] = useState<ParkingPoint[]>([]);
  const [publicAreas, setPublicAreas] = useState<PublicArea[]>([]);
  const [loadingParking, setLoadingParking] = useState(false);
  const [loadingPublicAreas, setLoadingPublicAreas] = useState(false);

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

  // Debounced fetch for public areas
  useEffect(() => {
    if (!showPublicAreas) {
      setPublicAreas([]);
      // Only abort public areas controller
      if (mapDataAbortControllerRef.current) {
        mapDataAbortControllerRef.current.abort();
        mapDataAbortControllerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      // Optimization: Only fetch if moved significantly or radius changed
      const threshold = Math.min(radius * 0.1, 50);
      const now = Date.now();
      const optionsKey = `${showPublicAreas}`;

      if (lastFetchRef.current) {
        const dist = getDistance(startPos, lastFetchRef.current.pos);
        const radiusDiff = Math.abs(fetchRadius - lastFetchRef.current.radius);
        const timeDiff = now - lastFetchRef.current.time;
        const optionsChanged = optionsKey !== lastFetchRef.current.options;

        // Only skip if we have data AND nothing significant changed
        if (dist < threshold && radiusDiff < 10 && !optionsChanged && publicAreas.length > 0) return;
        if (timeDiff < 3000 && !optionsChanged && publicAreas.length > 0) return;
      }

      handleFetchMapData(fetchRadius);
    }, 300);

    return () => clearTimeout(timer);
  }, [showPublicAreas, startPos, fetchRadius, radius, publicAreas.length]);

  useEffect(() => {
    if (error?.includes("rate limit")) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleFetchMapData = async (currentRadius: number) => {
    const optionsKey = `${showPublicAreas}`;
    const cacheKey = `${startPos[0].toFixed(4)},${startPos[1].toFixed(4)},${currentRadius},${optionsKey}`;
    const now = Date.now();

    if (mapDataCache.current[cacheKey]) {
      const cached = mapDataCache.current[cacheKey];
      setPublicAreas(cached.publicAreas);
      lastFetchRef.current = { pos: startPos, radius: currentRadius, time: now, options: optionsKey };
      return;
    }

    setLoadingPublicAreas(true);

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
        { parking: false, publicAreas: showPublicAreas },
        controller.signal
      );

      setPublicAreas(result.publicAreas);
      mapDataCache.current[cacheKey] = result;
      lastFetchRef.current = { pos: startPos, radius: currentRadius, time: now, options: optionsKey };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError' && controller.signal.aborted) return;
      console.error("Map data fetch error:", err);
      setShowPublicAreas(false);
      setError("The data servers are currently overloaded. Please try again in a few moments.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoadingPublicAreas(false);
    }
  };

  // Fetch parking spots near the attractor
  useEffect(() => {
    if (!showParking || !attractor) {
      setParkingSpots([]);
      return;
    }

    const fetchParking = async () => {
      setLoadingParking(true);
      try {
        const result = await fetchMapData(
          attractor.lat,
          attractor.lon,
          1000, // Look within 1km of the attractor for parking spots
          { parking: true, publicAreas: false }
        );

        // Calculate distance from attractor to each parking spot
        const withDistance = result.parkingSpots.map(spot => ({
          ...spot,
          distance: getDistance([attractor.lat, attractor.lon], [spot.lat, spot.lon])
        }));

        // Sort by distance and take top 3
        withDistance.sort((a, b) => a.distance - b.distance);
        setParkingSpots(withDistance.slice(0, 3));
      } catch (err) {
        console.error("Error fetching parking spots near attractor:", err);
        setError("Failed to load parking spots. Please try again.");
        setTimeout(() => setError(null), 5000);
      } finally {
        setLoadingParking(false);
      }
    };

    fetchParking();
  }, [showParking, attractor]);

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
      const quantumNumbers = await fetchQuantumNumbers(2048);
      const result = calculateAttractor(startPos[0], startPos[1], radius, quantumNumbers, selectedIntention);
      setAttractor(result);
    } catch (err) {
      console.error("Generation error:", err);
      setError("Error during generation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (lat: number, lon: number) => {
    if (attractor) return;
    setStartPos([lat, lon]);
  };

  const currentIntention = INTENTIONS.find(i => i.id === selectedIntention)!;

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
          className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white pointer-events-auto border border-white/10 cursor-pointer"
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
            className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 shadow-lg active:scale-95 transition-transform cursor-pointer"
            title="My position"
          >
            <LocateFixed className="w-6 h-6" />
          </button>

          <button
            onClick={() => setShowPublicAreas(!showPublicAreas)}
            className={`w-12 h-12 backdrop-blur-md rounded-full flex items-center justify-center border shadow-lg active:scale-95 transition-all cursor-pointer ${showPublicAreas
              ? 'bg-green-600 text-white border-green-400'
              : 'bg-white/10 text-white border-white/10'
              }`}
            title="Show public areas"
          >
            {loadingPublicAreas && showPublicAreas ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <Trees className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={() => setShowParking(!showParking)}
            className={`w-12 h-12 backdrop-blur-md rounded-full flex items-center justify-center border shadow-lg active:scale-95 transition-all cursor-pointer ${showParking
              ? 'bg-blue-600 text-white border-blue-400'
              : 'bg-white/10 text-white border-white/10'
              }`}
            title="Show nearby parking"
          >
            {loadingParking && showParking ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <Car className="w-6 h-6" />
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
                      className="w-6 h-6 flex items-center justify-center bg-black/20 hover:bg-black/40 rounded-full text-zinc-400 hover:text-white transition-colors border border-white/5 cursor-pointer"
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
              <button
                onClick={() => setShowIntentionModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer hover:opacity-80 active:scale-95"
                style={{
                  backgroundColor: `${currentIntention.color}22`,
                  borderColor: `${currentIntention.color}55`,
                }}
              >
                <currentIntention.Icon
                  className="w-4 h-4 shrink-0"
                  style={{ color: currentIntention.color }}
                />
                <span className="text-sm font-medium truncate max-w-[140px]" style={{ color: currentIntention.color }}>
                  {currentIntention.name}
                </span>
                <ChevronDown className="w-3 h-3 shrink-0" style={{ color: currentIntention.color }} />
              </button>
              <span className="text-sm font-bold text-purple-400">{radius}m</span>
            </div>

            <RadiusSlider radius={radius} setRadius={setRadius} setFetchRadius={setFetchRadius} />

            <button
              onClick={handleGenerate}
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all cursor-pointer ${loading
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
                  Generate Destination
                </>
              )}
            </button>

            {error && (
              <p className="mt-3 text-center text-xs text-red-400 font-medium">{error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Intention Selection Modal */}
      <AnimatePresence>
        {showIntentionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-end justify-center p-4 pb-6"
            onClick={() => { setShowIntentionModal(false); setActiveTooltip(null); }}
          >
            {/* Floating tooltip — rendered inside backdrop to escape overflow:hidden of modal card */}
            <AnimatePresence>
              {activeTooltip && (() => {
                const tip = INTENTIONS.find(i => i.id === activeTooltip.id)!;
                return (
                  <motion.div
                    key={activeTooltip.id}
                    initial={{ opacity: 0, scale: 0.92, x: 6 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.92, x: 6 }}
                    transition={{ duration: 0.15 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'fixed',
                      top: activeTooltip.top,
                      right: activeTooltip.right,
                      zIndex: 3000,
                      maxWidth: '220px',
                      maxHeight: `${window.innerHeight - 28}px`,
                      overflowY: 'auto',
                      backgroundColor: '#1c1c1f',
                      border: `1px solid ${tip.color}35`,
                      borderLeft: `3px solid ${tip.color}`,
                      borderRadius: '12px',
                      padding: '10px 14px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                    }}
                  >
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      {tip.description}
                    </p>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Choose your Intention</h2>
                <button
                  onClick={() => setShowIntentionModal(false)}
                  className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[60vh] p-2 space-y-0.5 scrollbar-dark">
                {INTENTIONS.map(intention => {
                  const isSelected = selectedIntention === intention.id;
                  const isActive = activeTooltip?.id === intention.id;
                  const { Icon } = intention;
                  return (
                    <div key={intention.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        className={`flex-1 text-left flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${isSelected ? 'bg-white/10 border border-white/15' : 'hover:bg-white/5 border border-transparent'
                          }`}
                        onClick={() => {
                          setSelectedIntention(intention.id);
                          setShowIntentionModal(false);
                          setActiveTooltip(null);
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${intention.color}20`,
                            border: `1px solid ${intention.color}40`,
                          }}
                        >
                          <Icon className="w-4 h-4" style={{ color: intention.color }} />
                        </div>
                        <span className={`flex-1 text-sm font-medium ${isSelected ? 'text-white' : 'text-zinc-300'
                          }`}>
                          {intention.name}
                        </span>
                        {isSelected && (
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: intention.color }}
                          />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          if (activeTooltip?.id === intention.id) {
                            setActiveTooltip(null);
                          } else {
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            const TOOLTIP_H = 110;
                            const MARGIN = 14;
                            const idealTop = rect.top + rect.height / 2 - TOOLTIP_H / 2;
                            const clampedTop = Math.min(
                              Math.max(idealTop, MARGIN),
                              window.innerHeight - TOOLTIP_H - MARGIN
                            );
                            setActiveTooltip({
                              id: intention.id,
                              top: clampedTop,
                              right: window.innerWidth - rect.left + 8,
                            });
                          }
                        }}
                        className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer shrink-0 ${isActive ? 'bg-white/15 text-zinc-200' : 'hover:bg-white/10 text-zinc-500 hover:text-zinc-300'
                          }`}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  The principle is to break your daily routine by guiding you toward areas of high "vibration", identified using a Kernel Density Estimation (KDE) computed from 512 random GPS points.
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
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
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
