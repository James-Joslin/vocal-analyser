# Acoustic Stress Monitor — Code Review & Refactoring Notes

## Critical Bugs Fixed

### 1. `stopSession` references undefined `stream` variable (App.tsx:519–521)

**Severity: crash**

The original `stopSession` function contained:

```ts
setIsRecording(false);
if (privacyMode === 'hybrid') {
  startBackendRecorder(stream);  // ← `stream` is undefined here
}
```

`stream` was a local variable inside `startMicrophoneSession`, not in scope.
Beyond the reference error, the logic was backwards — a stop function should
not restart the recorder.

**Fix:** Removed entirely. Stop means stop. Recorder restart (for chunked
uploads) already happens in `recorder.onstop` when the session is still active.

---

### 2. MediaRecorder `onstop` reads stale `isRecording` / `microphoneStream` (App.tsx:302–313)

**Severity: silent failure — recorder never restarts between chunks**

```ts
recorder.onstop = () => {
  // ...
  if (isRecording && microphoneStream && !isSimulated) {  // ← stale closure
    recorder.start(6000);
  }
};
```

`isRecording`, `microphoneStream`, and `isSimulated` are React state values
captured at the time `startBackendRecorder` was called. They never update
inside this callback, so the restart condition is always evaluated against
the initial values.

**Fix:** `useAudioCapture` hook stores these in refs (`recordingRef`,
`simulatedRef`) that stay current, and the `onstop` handler reads the refs.

---

### 3. SpeechRecognition `onend` reads stale `isRecording` (App.tsx:571–575)

**Severity: speech recognition stops and never restarts**

Same stale-closure pattern. The `onend` handler captured `isRecording`
at construction time (always `false` at that point), so the auto-restart
condition never passed.

**Fix:** Reads `recordingRef.current` instead.

---

### 4. Breathing guide timer uses stale phase for duration (App.tsx:167–189)

**Severity: incorrect timing — every phase gets the wrong duration**

```ts
setCurrentBreathingPhase(curr => {
  switch (curr) {
    case 'Inhale': return 'Hold';
    // ...
  }
});
// ↓ This reads currentBreathingPhase BEFORE the state update commits
return currentBreathingPhase === 'Inhale' ? 7 : ...
```

`setCurrentBreathingPhase` is async — the new phase hasn't committed when
the timer duration is computed, so each phase gets the previous phase's
duration (Inhale gets Pause's 4s, Hold gets Inhale's 7s, etc.).

**Fix:** `useBreathingGuide` hook derives the next duration from the next
phase in a single synchronous step, using a ref to track the current phase.

---

### 5. Unused imports (App.tsx:24–31)

`Loader2`, `Info`, `Layers`, `BrainCircuit`, `MessageSquareX` are imported
but never used. Removed.

---

### 6. Dead state and refs (App.tsx)

- `apiReady` is set but never read anywhere in the render tree.
- `linesRef` is kept in sync but never consumed.
- `timerRef` is declared but never assigned or read.

Removed all three.


## Structural Issues Fixed

### Missing `package.json`

The project had no `package.json` at all — it could not be installed or
built. Created one with the correct dependency set.

### Port configuration inconsistency

| Source                | Port  |
|-----------------------|-------|
| `server.ts`           | 3001 (hardcoded)  |
| `docker-compose.yml`  | 3000 (via `PORT` env) |
| `vite.config.ts`      | 3001 (default fallback) |

These disagreed, meaning Docker and local dev behaved differently.

**Fix:** Unified on port 3000 throughout, driven by `PORT` env var with a
single 3000 default.

### Flat file structure

All source files lived at the project root — components imported from
`../types` which only worked by accident. No separation between client
code, server code, and Python API.

**Fix:** Standard structure:

```
src/
  components/    — React UI components
  hooks/         — Custom hooks (audio, breathing, health, alerts)
  services/      — API client functions
  lib/           — Pure utility functions
  types/         — TypeScript interfaces
server/
  routes/        — Express route handlers
  lib/           — Server-side utilities
python-api/      — FastAPI backend (unchanged)
```

### Monolithic App.tsx (1058 lines)

The original `App.tsx` contained:
- All application state (20+ `useState` calls)
- Audio capture and MediaRecorder management
- Web Speech Recognition setup
- Acoustic signal processing
- Sentiment API calls with local fallback
- Alert debouncing and sound generation
- Breathing guide timer
- Backend health polling
- Session lifecycle management
- Simulation mode logic
- The entire render tree

**Fix:** Extracted into focused units:

| Module                  | Responsibility                                  | Lines |
|-------------------------|-------------------------------------------------|-------|
| `useAudioCapture`       | Mic access, MediaRecorder, Speech Recognition   | 243   |
| `useBreathingGuide`     | 4-7-8 breathing timer                           | 56    |
| `useApiHealth`          | Backend readiness polling                       | 39    |
| `useStressAlerts`       | Alert debounce, sound, visual flash             | 96    |
| `services/api.ts`       | All fetch calls                                 | 47    |
| `lib/acoustics.ts`      | Signal processing (RMS, pitch, centroid, etc.)  | 121   |
| `lib/constants.ts`      | IDs, timestamps, simulation data                | 63    |
| `Header`                | Top nav bar                                     | 94    |
| `SettingsPanel`         | Configuration UI                                | 168   |
| `MicrophoneError`       | Permission denied banner                        | 52    |
| `InterventionPanel`     | Breathing guide + alert feed                    | 93    |
| **App.tsx (refactored)**| Composition and session data                    | 365   |

### Monolithic server.ts (188 lines)

Scenario data, sentiment analysis, and server bootstrap were all inline.

**Fix:** Split into `server/routes/scenarios.ts`, `server/routes/sentiment.ts`,
`server/lib/sentiment.ts`, and a clean `server/index.ts` entry point.

### Misleading model label

`server.ts` returned `modelClass: "Self-Hosted-Local-Llama-FineTune"` for
what was actually a keyword-matching heuristic with no ML model involved.

**Fix:** Renamed to `KeywordHeuristicAnalyser`.


## Configuration Improvements

| File            | Change                                            |
|-----------------|---------------------------------------------------|
| `package.json`  | Created (was completely missing)                  |
| `.env.example`  | Created with all required env vars documented     |
| `tsconfig.json` | Enabled `strict`, `noUnusedLocals`, `noUnusedParameters` |
| `vite.config.ts`| Fixed `@` alias to resolve to `src/`, unified port |
| `docker-compose`| Matched `VITE_PORT` to `PORT` (both 3000)         |


## What Was Left Unchanged

- **Python API** (`main.py`, `requirements.txt`, Python `Dockerfile`) — the
  FastAPI backend is well-structured and the ML pipeline logic is sound.


## Architecture Simplification: Single Self-Hosted Backend

All analysis now routes exclusively through the Python API container
(Whisper + Wav2Vec2 + DistilBERT). The following were removed:

| Removed                              | Reason                                      |
|--------------------------------------|---------------------------------------------|
| `PrivacyMode` type                   | No mode switching — one backend only         |
| `privacyMode` state + UI toggle      | No local/hybrid choice to make               |
| `LOCAL_CRISIS_KEYWORDS`              | Client-side heuristic fallback eliminated    |
| Client-side keyword sentiment branch | `handleSpeechLineText` always calls the API  |
| `server/lib/sentiment.ts`            | Express no longer runs its own analysis      |
| `server/routes/sentiment.ts`         | Sentiment route removed from Express         |
| Footer "Privacy Mode" display        | Replaced with "Self-Hosted Python API"       |

The Express server now only:
1. Serves the Vite frontend (dev middleware or static in production)
2. Proxies `/api/*` to the Python container in production
3. Serves the `/api/scenarios` demo data endpoint

In development, the Vite dev server proxy handles `/api/*` → Python API
directly. In production, `http-proxy-middleware` does the same job from
the Express server.
- **D3 visualisation components** (`AcousticVisualizer`, `StressTrendsChart`) —
  the rendering logic is correct; only import paths were updated.
- **MetricCard, TranscriptArea, ReportingExporter** — same treatment;
  import paths fixed, no logic changes needed.
- **`index.css`** — Tailwind config and print styles are fine as-is.
