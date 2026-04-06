"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Like useState but persists the value to localStorage so form data
 * survives PWA backgrounding, page reloads, and browser-killed tabs.
 *
 * Returns [state, setState, clearDraft, wasRestored].
 * - Call clearDraft() on explicit cancel (discard) or successful submit.
 * - wasRestored is true if the state was loaded from a saved draft.
 */
export function useFormDraft<T>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>, () => void, boolean] {
  const [wasRestored] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(key);
    } catch {
      return false;
    }
  });

  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved) as T;
    } catch {}
    return initial;
  });

  // Skip the first effect run so we don't write the initial value back
  // to localStorage when there was no prior draft.
  const skipFirst = useRef(true);
  // Prevent re-writing to localStorage after clearDraft() is called
  const cleared = useRef(false);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (cleared.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);

  const clearDraft = () => {
    cleared.current = true;
    try {
      localStorage.removeItem(key);
    } catch {}
  };

  return [state, setState, clearDraft, wasRestored];
}
