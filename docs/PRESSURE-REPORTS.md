# Pressure-pattern reports — 22 October 2026

Interface wording update: the generated report's source tab and labels now say **Preview** instead of **Simulation**. Its values and rules remain illustrative; the **My insole** assessment still requires actual validated measurements.

Reports now begins with Ulcer analytics, using the user's supplied rounded paired-bar chart as the visual reference. The current normal walking simulation displays **Low**, **Normal pattern**, **No unusual pressure detected**, and **0 regions to review**. “Low” refers to this simulation's pressure alert level, not an ulcer diagnosis or a clinically validated risk score.

## Graph and report source

The chart is adapted to native SVG so it works in the existing Expo app without Recharts, Motion's DOM renderer or a WebView. Black bars show peak relative pressure; gray bars show average relative pressure on the same zero-based 0–100 axis. Selecting a bar exposes its region, peak, average, repeated off-phase cycles and longest unusual run. The five groups are heel, lateral midfoot/arch, metatarsal heads, big toe and other toes.

The 1-cycle and 10-cycle controls represent 4.2 or 42 seconds of the existing illustrative walking model. They are not calendar history. Both feet are sampled, with the same half-cycle offset used in the heatmap. Regional values are derived from the existing fourteen-lobe pressure field. No sample transactions, percentages, fictional patient days or invented kPa values from the source example are reused.

Peak pressure can reach red/100 in the normal model. A high peak alone does not raise an alert when it occurs in the expected gait phase.

## Illustrative pattern check

`src/pressureAnalytics.ts` accepts samples with time, foot side, gait phase, cycle and regional relative pressure. It compares each region against the corresponding phase of the illustrative model and tracks exposure separately for each foot/region.

The example rules are explicitly simulation-only:

- Candidate unusual load: relative amplitude at least 0.85 and more than 0.12 above that region's model reference at the same phase.
- Repeated review flag: at least 3 flagged cycles and at least 1.2 seconds of accumulated off-phase high load in the same foot/region.
- Consecutive exposure is accumulated only between valid flagged samples no more than 150 ms apart. Missing, duplicate or widely spaced samples cannot create an imaginary continuous exposure.
- A normal result requires complete regional values, known phases, both feet, phase coverage and approximately a full cycle. Empty, short, incomplete or unphased inputs never become a normal result. Known unusual observations may still be marked for review while coverage is incomplete.

These constants implement the user's example of phase, duration and repetition. They are not clinical cutoffs, pressure-injury dose limits or a validated patient baseline. A persistently loaded heel during unloading or a repeatedly high big toe during initial loading is flagged in synthetic counterexample tests; this does not establish ulcer-detection accuracy.

## Actual device boundary

The My insole tab displays **Not assessed** and removes the Low/No unusual pressure message. Current relative sensor frames and sparse saved snapshots do not provide verified gait-phase history, a calibrated personal reference or a validated clinical assessment. This change does not analyze those frames as an ulcer detector.

Simulation calculations are local and held in memory. They never save readings, alter patient measurements, write device links, enter health exports, or call an AI provider. Existing health-record charts and exports remain below the new pressure section. Connecting actual hardware still requires the existing protocol/calibration work.

This wording keeps pressure-pattern observations distinct from clinical assessment. [NICE pressure-ulcer guidance](https://www.nice.org.uk/guidance/cg179/chapter/Recommendations) describes risk-factor assessment, clinical judgement and trained skin assessment; a normal synthetic pressure trace is not evidence that a person has no ulcer risk.

## Verification

- TypeScript and Expo lint pass.
- All 66 automated checks pass: 13 unit/contract, 35 backend/model and 18 preserved gateway tests. New checks cover expected red peaks, repeated heel loading during unloading, early big-toe loading, brief versus repeated events, missing coverage/phases, short histories and gaps.
- Web production export and fresh iOS/Android Hermes exports pass. These are JavaScript/asset exports, not new signed APK/IPA files or physical-device tests.
- At 390×844 and 320×740, the summary and paired bars fit the viewport. Bar selection updates peak/average and region notes. Cycle selection updates the represented duration, and the explanation expands/collapses.
- Switching to My insole shows Not assessed, with zero Low or No unusual pressure messages in that mode. Returning to Simulation restores the generated report.
- Desktop layout uses a centered 680 px report column; existing health-record layouts retain their previous responsive behavior.
- No clinical validation, real pressure-history assessment or physical-phone execution is established by these checks.

Screenshots: `screenshots/neem-pressure-report-summary-mobile.png` and `screenshots/neem-pressure-report-chart-mobile.png`. They show explicitly simulated pressure values, not measured patient pressure.
