"use client";

import { useSyncExternalStore } from "react";

// Browser-local clock for the home hero, via useSyncExternalStore —
// the React-recommended way to read a mutable external value (the
// clock) without hydration mismatches: the server snapshot is null,
// the client re-renders on every subscription tick.
function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 1000);
  return () => clearInterval(timer);
}

export function LiveClock() {
  const now = useSyncExternalStore(
    subscribe,
    () => new Date(),
    () => null,
  );

  const greeting = now
    ? now.getHours() < 11
      ? "Selamat pagi"
      : now.getHours() < 15
        ? "Selamat siang"
        : now.getHours() < 19
          ? "Selamat sore"
          : "Selamat malam"
    : "Selamat datang";

  const date = now
    ? now.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const time = now
    ? now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <span
      suppressHydrationWarning
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-blue-50 backdrop-blur-sm"
    >
      <span>{greeting}</span>
      {now && (
        <>
          <span className="hidden text-blue-200 sm:inline">·</span>
          <span className="hidden sm:inline">{date}</span>
          <span className="text-blue-200">·</span>
          <span className="tabular-nums">{time}</span>
        </>
      )}
    </span>
  );
}
