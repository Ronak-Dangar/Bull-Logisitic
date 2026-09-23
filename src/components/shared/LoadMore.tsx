"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

// Infinite-scroll trigger: loads the next page when scrolled near the bottom,
// with a tap-able button as fallback.
export function LoadMore({ hasMore, loading, onLoadMore }: { hasMore: boolean; loading: boolean; onLoadMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onLoadMore);
  useEffect(() => { cb.current = onLoadMore; });

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loading) return;
    // Observe relative to the app's scrolling <main>, so we can prefetch before the user hits bottom.
    const root = el.closest("main");
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) cb.current(); },
      { root, rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading]); // re-armed after each load, so a still-visible trigger fires again

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex justify-center py-4">
      <button
        onClick={onLoadMore}
        disabled={loading}
        className="btn-secondary h-9 px-4 text-xs w-auto"
      >
        {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</> : "Load more"}
      </button>
    </div>
  );
}
