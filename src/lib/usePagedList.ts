"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Page } from "@/lib/pagination";

type Fetcher<T, F> = (args: F & { cursor?: string | null; take?: number }) => Promise<Page<T>>;

/**
 * Client state for a server-paginated, server-filtered list.
 * - Refetches page 1 whenever `filters` change (stale responses are dropped).
 * - `loadMore()` appends the next page.
 * - `reload()` re-queries everything currently loaded — use after a mutation
 *   instead of router.refresh(), so the user keeps their place in the list.
 */
export function usePagedList<T extends { id: string }, F extends object>(
  initial: Page<T>,
  filters: F,
  fetchPage: Fetcher<T, F>
) {
  const [items, setItems] = useState<T[]>(initial.items);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [total, setTotal] = useState<number | null>(initial.total);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Bumped on every filter change / reload so late responses from older queries are ignored.
  const requestId = useRef(0);
  const filtersRef = useRef(filters);
  const itemsRef = useRef(items);
  const fetchRef = useRef(fetchPage);
  // Declared first so every effect below sees the latest values.
  useEffect(() => {
    filtersRef.current = filters;
    itemsRef.current = items;
    fetchRef.current = fetchPage;
  });

  const filtersKey = JSON.stringify(filters);
  const lastKey = useRef(filtersKey);
  const lastInitial = useRef(initial);

  useEffect(() => {
    if (filtersKey === lastKey.current) return; // also keeps StrictMode's double-run a no-op
    lastKey.current = filtersKey;
    const id = ++requestId.current;
    setLoading(true);
    fetchRef.current({ ...filtersRef.current })
      .then((page) => {
        if (id !== requestId.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setTotal(page.total);
      })
      .catch(console.error)
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [filtersKey]);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const page = await fetchRef.current({
        ...filtersRef.current,
        take: Math.max(itemsRef.current.length, 1),
      });
      if (id !== requestId.current) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // New server props (e.g. something called router.refresh()) → re-sync what's loaded.
  useEffect(() => {
    if (initial === lastInitial.current) return;
    lastInitial.current = initial;
    reload();
  }, [initial, reload]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await fetchRef.current({ ...filtersRef.current, cursor: nextCursor });
      if (id !== requestId.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  return { items, setItems, total, hasMore: !!nextCursor, loading, loadingMore, loadMore, reload };
}

/** Returns `value` after it has stopped changing for `ms`. */
export function useDebouncedValue<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Local-day start/end as ISO instants for a YYYY-MM-DD date input value. */
export function dayRange(from: string, to: string) {
  return {
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  };
}
