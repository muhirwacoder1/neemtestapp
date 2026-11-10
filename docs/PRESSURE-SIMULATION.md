# Walking pressure and connection simulation — 22 October 2026

Interface wording update: generated activity is now labeled **Preview**, **Connection preview** and **Preview ready** throughout the app. The underlying simulation remains separate from Bluetooth, real sensor measurements and saved health records. These wording changes do not establish hardware connectivity.

## Requested visual sequence

The walking preview now blends several loaded regions at once instead of moving a single isolated hotspot up the foot. The illustrative palette runs blue → cyan → green → yellow → orange → red.

| Stage | Heel | Metatarsal heads | Big toe |
| --- | --- | --- | --- |
| Initial loading | Red | Orange | Lower green/cyan load |
| Mid-stance | Red | Red | Orange with green edges |
| Terminal stance | Green | Red | Orange |
| Pre-swing | Green fading to blue | Red fading to orange | Red |
| Swing | Blue | Blue | Blue |

The user supplied the desired relative color pattern. It is an educational preset, not a measured normal range or a clinical gait classifier. “Initial loading” means the early loading response, rather than claiming that all forefoot regions bear weight at the literal instant of heel contact. The distinction between first heel contact and subsequent metatarsal contact is described in [Gait Segmentation Method Using a Plantar Pressure Measurement System with Custom-Made Capacitive Sensors](https://pmc.ncbi.nlm.nih.gov/articles/PMC7038314/).

## Rendering

`src/pressure.ts` defines fourteen preview-only lobes: two heel areas, two arch/midfoot areas, five metatarsal heads and five individual toes. Smooth interpolation between amplitudes preserves simultaneous loads, while an overlapping peak blend avoids flattening all adjacent hotspots into one saturated band. The low-load medial arch stays mostly blue. The feet are oriented with their big toes facing inward. Walking alternates the feet by half a cycle; the stage controls deliberately put both feet at the same point for comparison.

Native uses a Skia runtime shader driven by a Reanimated clock. Web uses a canvas field with cached spatial weights, skips pixels outside the sole and caps redraws near 30 fps. Playback respects reduced-motion preferences and stops while the app/page is inactive. Pause and manual stage selection stop playback. The 4.2-second display cycle is for legibility, not a measured cadence.

Live maps retain the original four-region sensor adapter and never receive synthetic preview amplitudes. Unknown live coverage remains unmeasured. A simulated big-toe hotspot does not assert that a physical big-toe sensor exists.

## Connection preview

Opening Connect my insole defaults to a Simulation tab when no real insole is linked:

`Searching → neem found → Connecting → Connected`

The product illustration pulses and floats during discovery/connection, then displays a checkmark and `neem · Connected · Simulation`. The user can open the walking heatmap, stop a pending sequence or replay it. The My insole tab retains the existing actual Bluetooth workflow.

Simulation state is held in memory, pauses its transitions while inactive, cancels pending transitions when closed/switched, and never changes the real `connected` flag, fabricates a battery value, links a device in Convex or saves sensor readings. Late timer callbacks cannot complete a canceled step. No Bluetooth permission is requested for this path.

## Verification

- Lint and TypeScript pass; all 61 tests pass (8 unit/contract, 35 backend/model, 18 preserved gateway).
- New tests verify simultaneous initial/mid-stance load, terminal heel unloading, big-toe push-off, swing unloading, bounded field values, continuous loop boundaries, alternating feet and preserved unknown live coverage.
- The exact native shader compiled successfully using the installed CanvasKit/Skia runtime-effect compiler, with 19 uniform floats and no compiler errors. This is not physical-device GPU verification.
- Fresh web export and iOS/Android Hermes exports pass. These are not a new signed APK or installed application.
- Browser checks at 390×844 cover every requested stage, inward-facing big toes, discovery/found/connecting/connected, stop remaining stopped, replay and opening the pressure map. Paused map screenshot bytes remained identical across checks; they changed after play resumed.
- At 320×740 both map bounds remain inside the viewport. Simulated visuals were inspected without writing health or device data.
- Real Bluetooth, firmware, calibrated pressure values, GPU performance on physical phones and a fresh native installation remain unverified.

Screenshots: `screenshots/neem-pressure-initial-mobile.png`, `neem-pressure-midstance-mobile.png`, `neem-pressure-terminal-mobile.png`, `neem-pressure-preswing-mobile.png`, `neem-connection-searching-mobile.png`, `neem-connection-connecting-mobile.png`, and `neem-connection-connected-mobile.png`.
