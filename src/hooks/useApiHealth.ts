import { useEffect, useState } from "react";
import type { ApiReadyResponse, ApiStatus } from "../types";
import { fetchApiReady } from "../services/api";

const POLL_INTERVAL_MS = 10_000;

/**
 * Polls the Python backend readiness endpoint and exposes its status.
 */
export function useApiHealth() {
  const [apiReady, setApiReady] = useState<ApiReadyResponse | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const payload = await fetchApiReady();
        if (cancelled) return;
        setApiReady(payload);
        setApiStatus(payload.ready ? "ready" : "degraded");
      } catch {
        if (cancelled) return;
        setApiStatus("offline");
      }
    };

    check();
    const handle = window.setInterval(check, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, []);

  return { apiReady, apiStatus };
}
