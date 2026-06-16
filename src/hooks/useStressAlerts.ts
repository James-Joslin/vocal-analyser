import { useCallback, useRef, useState } from "react";
import type { InterventionAlert } from "../types";
import { uid, timestamp } from "../lib/constants";
import { INTERVENTION_SUGGESTIONS } from "../lib/constants";

const ALERT_COOLDOWN_MS = 8_000;

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Encapsulates alert triggering, debounce, sound, and visual flash.
 */
export function useStressAlerts() {
  const [interventions, setInterventions] = useState<InterventionAlert[]>([]);
  const [visualFlashActive, setVisualFlashActive] = useState(false);
  const [muteAudioAlerts, setMuteAudioAlerts] = useState(false);

  const lastAlertRef = useRef(0);

  const playAlertChime = useCallback(
    (score: number) => {
      if (muteAudioAlerts) return;
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(score > 85 ? 580 : 380, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } catch {
        // AudioContext may be blocked by autoplay policy — swallow silently.
      }
    },
    [muteAudioAlerts],
  );

  /**
   * Fire an intervention alert if enough time has passed since the last one.
   * Returns `true` if an alert was actually emitted.
   */
  const triggerAlert = useCallback(
    (score: number, source: "acoustic" | "linguistic"): boolean => {
      const now = Date.now();
      if (now - lastAlertRef.current < ALERT_COOLDOWN_MS) return false;
      lastAlertRef.current = now;

      playAlertChime(score);

      const alert: InterventionAlert = {
        id: uid("alert"),
        timestamp: timestamp(),
        type: "critical",
        title: `STRESS THRESHOLD EXCEEDED (${Math.round(score)}%)`,
        message: pickRandom(INTERVENTION_SUGGESTIONS[source]),
        severity: score > 85 ? "high" : "medium",
        acknowledged: false,
      };

      setInterventions((prev) => [alert, ...prev]);

      setVisualFlashActive(true);
      setTimeout(() => setVisualFlashActive(false), 1500);

      return true;
    },
    [playAlertChime],
  );

  const dismissAlert = useCallback((id: string) => {
    setInterventions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    );
  }, []);

  const resetAlerts = useCallback(() => {
    setInterventions([]);
  }, []);

  return {
    interventions,
    visualFlashActive,
    muteAudioAlerts,
    setMuteAudioAlerts,
    triggerAlert,
    dismissAlert,
    resetAlerts,
  };
}
