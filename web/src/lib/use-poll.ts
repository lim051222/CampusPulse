"use client";

import { useCallback, useEffect, useState } from "react";

/** Polls an async loader on an interval; keeps the previous value while refreshing. */
export function usePoll<T>(loader: () => Promise<T>, intervalMs = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    try {
      setData(await loader());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void run();
    const id = window.setInterval(() => void run(), intervalMs);
    return () => window.clearInterval(id);
  }, [run, intervalMs]);

  return { data, error, loading, refresh: run };
}
