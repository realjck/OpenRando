# OpenRando

## Business Requirements

- An open-source, web-based alternative to Randonautica that generates unique random real-world coordinates for exploration
- The user sets a starting point (via GPS or map click) and a search radius (500m to 5km)
- The user selects an Intention (one of 9 quantum generation strategies) before generating
- The app generates a destination point based on Kernel Density Estimation applied to CSPRNG random points
- Destination coordinates can be opened directly in Google Maps
- Optional overlay: parks, forests, and other public areas within the radius (polygon display)
- Optional overlay: the 3 closest parking spots to the generated destination (marker display)
- The app runs entirely client-side, no backend, no user accounts, no persistence

## Technical Details

- Built with React 19, TypeScript, Vite 6, Tailwind CSS v4
- Map rendering: `react-leaflet` + Leaflet.js with a dark CARTO tile layer
- Animations: `motion` (Motion for React)
- Icons: `lucide-react`
- Deployed as a static site on GitHub Pages at `/OpenRando/` base path
- All logic is client-only — no server, no API keys required

## Project Structure

```
src/
  App.tsx               # Single-page app: all UI, state, map, and event logic
  index.css             # Global styles (minimal, Tailwind entry point)
  main.tsx              # React entry point
  services/
    quantumService.ts   # CSPRNG random generation + KDE attractor calculation
    mapDataService.ts   # Overpass API calls for parking spots and public areas
public/
  manifest.json         # Web app manifest
index.html              # HTML entry point
vite.config.ts          # Vite config (base path, plugins, HMR)
```

## Core Algorithms

### Attractor Calculation (`quantumService.ts`)
1. Resolve the active `IntentionType` to its `IntentionConfig` (point count + KDE selector)
2. Generate N random GPS points within the radius using the browser's native CSPRNG (`crypto.getRandomValues`), where N varies per intention (256–1024)
3. Convert raw `Uint16Array` integers (0–65535) to polar coordinates (random radius + angle)
4. Apply Silverman bandwidth estimation (KDE) over a 100×100 grid
5. Select the result cell based on the intention's `kdeSelector`: `'max'` (highest density), `'min'` (lowest density), or a percentile fraction (0–1)

#### Intention Configs

| Intention | Point Count | KDE Selector |
|---|---|---|
| `explore` | 512 | 50th percentile |
| `routine` | 256 | 75th percentile |
| `synchronicity` | 1024 | max |
| `anomaly` | 512 | 85th percentile |
| `attractor` | 1024 | max |
| `repeller` | 512 | min |
| `planeshifting` | 256 | 25th percentile |
| `trial` | 512 | 90th percentile |
| `quest` | 768 | 60th percentile |

### Map Data (`mapDataService.ts`)
- Queries the Overpass API (with fallback across 4 mirror instances) for:
  - `amenity=parking` nodes/ways for parking spots
  - `leisure` / `landuse` ways/relations for public areas (parks, forests, etc.)
- Public areas: fetched debounced on position/radius change, with caching and abort control
- Parking spots: fetched around the attractor (1km radius) when toggled, top 3 closest shown

## Color Scheme and UI

- Dark theme throughout (`bg-zinc-900`, `bg-black`)
- Accent purple `#8b5cf6` (purple-500): attractor marker, radius circle, KDE score badge
- Blue `#3b82f6` (blue-500): parking spots markers and toggle button
- Green `#22c55e` (green-500): public area polygons and toggle button
- Map tile: CartoDB dark_all

### Intention Colors
Each intention has its own accent color used in the capsule button and modal:

| Intention | Color |
|---|---|
| Explore the Unknown | `#6366f1` (indigo) |
| Break the Routine | `#f97316` (orange) |
| Synchronicity | `#a855f7` (purple) |
| The Anomaly | `#14b8a6` (teal) |
| Attractor | `#8b5cf6` (violet) |
| Repeller | `#ef4444` (red) |
| Planeshifting | `#22d3ee` (cyan) |
| The Trial | `#f59e0b` (amber) |
| The Quest | `#84cc16` (lime) |

The intention selector is a compact capsule button in the control panel. Clicking it opens a bottom-sheet modal with a list of intentions, each with an icon, name, and an info button that shows a floating viewport-aware tooltip.

## Coding Standards

1. Use latest idiomatic React (hooks, `memo` for pure components, `useRef` for non-reactive state)
2. Keep it simple — no over-engineering, no unnecessary abstraction
3. Single-file UI (`App.tsx`) is intentional; do not split into many components unless truly warranted
4. All coordinates in `[lat, lon]` order (Leaflet convention)
5. No emojis in code or comments
6. TypeScript strict mode, run `npm run lint` (`tsc --noEmit`) to type-check

## Build and Deployment

```bash
npm run lint      # TypeScript type-check
npm run build     # Production build to dist/
npm run preview   # Preview the production build locally
```

The app is deployed to GitHub Pages via the `.github/` workflow. The `base` in `vite.config.ts` is set to `/OpenRando/`.

## External Services

- **Overpass API**: used for map data (parking, public areas). No API key required. Four fallback mirrors are tried in sequence.
- **Google Maps**: attractor and parking popups link to `https://www.google.com/maps/search/?api=1&query=lat,lon`
- No other external APIs or analytics.
