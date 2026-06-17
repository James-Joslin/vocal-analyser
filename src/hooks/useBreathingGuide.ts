import { useEffect, useRef, useState } from "react";

type Phase = "Inhale" | "Hold" | "Exhale" | "Pause";

/**
 * Duration in seconds for each phase of the 4-7-8 breathing cycle.
 */
const PHASE_DURATIONS: Record<Phase, number> = {
  Inhale: 4,
  Hold: 7,
  Exhale: 8,
  Pause: 4,
};

const PHASE_ORDER: Phase[] = ["Inhale", "Hold", "Exhale", "Pause"];

function nextPhase(current: Phase): Phase {
  const idx = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
}

/**
 * Runs a continuous 4-7-8 breathing guide timer.
 *
 * BUG FIX: The original implementation read `currentBreathingPhase` inside
 * the setBreathingTimer updater to decide the *next* timer duration, but
 * setCurrentBreathingPhase hadn't committed yet at that point — so the
 * duration always belonged to the phase we just *left*, not the one we
 * moved *to*.  This version derives the next duration from the next phase
 * in a single synchronous step.
 */
export function useBreathingGuide() {
  const [phase, setPhase] = useState<Phase>("Inhale");
  const [secondsLeft, setSecondsLeft] = useState(PHASE_DURATIONS.Inhale);

  // Keep a ref so the interval callback always sees the latest phase.
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    const handle = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;

        // Transition to the next phase and set its duration.
        const upcoming = nextPhase(phaseRef.current);
        setPhase(upcoming);
        return PHASE_DURATIONS[upcoming];
      });
    }, 1000);

    return () => clearInterval(handle);
  }, []); // stable — reads current phase through the ref

  return { phase, secondsLeft } as const;
}
