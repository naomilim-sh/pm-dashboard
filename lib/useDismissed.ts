"use client";

import { useEffect, useState } from "react";

// A per-browser "don't show this again" flag for nudges and tips — not
// something worth syncing to the database.
export function useDismissed(key: string) {
  // Start hidden so a dismissed tip never flashes in before storage is read.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);
  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(key, "1");
    } catch {}
  }
  return [dismissed, dismiss] as const;
}
