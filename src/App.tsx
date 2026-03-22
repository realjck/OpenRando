import { useState, useEffect, memo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation,
  Compass,
  ExternalLink,
  RefreshCw,
  Settings2,
  LocateFixed,
  Info,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchQuantumNumbers, calculateAttractor, AttractorResult } from './services/quantumService';

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

const RadiusSlider = memo(function RadiusSlider({ radius, setRadius }: { radius: number, setRadius: (val: number) => void }) {
  return (
    <input
      type="range"
      min="500"
      max="5000"
      step="100"
      value={radius}
      onChange={(e) => setRadius(Number.parseInt(e.target.value))}
      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500 mb-6"
    />
  );
});

export default function App() {
  const [startPos, setStartPos] = useState<[number, number]>([48.8566, 2.3522]); // Default Paris
  const [radius, setRadius] = useState(1000);
  const [attractor, setAttractor] = useState<AttractorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Get user location on mount
  useEffect(() => {
    handleGetCurrentLocation();
  }, []);

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
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Destination Found</span>
                    <h3 className="text-lg font-bold text-white">Quantum Attractor</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-500/20 px-2 py-1 rounded text-[10px] font-mono text-purple-300 border border-purple-500/30">
                      Score: {attractor.densityScore.toFixed(2)}
                    </div>
                    <button
                      onClick={() => setAttractor(null)}
                      className="w-7 h-7 flex items-center justify-center bg-black/20 hover:bg-black/40 rounded-full text-zinc-400 hover:text-white transition-colors border border-white/5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                    <span className="text-[10px] text-zinc-500 block uppercase">Latitude</span>
                    <span className="text-sm font-mono text-zinc-300">{attractor.lat.toFixed(6)}</span>
                  </div>
                  <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                    <span className="text-[10px] text-zinc-500 block uppercase">Longitude</span>
                    <span className="text-sm font-mono text-zinc-300">{attractor.lon.toFixed(6)}</span>
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

            <RadiusSlider radius={radius} setRadius={setRadius} />

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
