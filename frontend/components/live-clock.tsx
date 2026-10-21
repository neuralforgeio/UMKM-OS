"use client";

import { useEffect, useState } from "react";

// Formatters are static config, build them once at module level.
const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

type LiveClockProps = {
  className?: string;
  timeClassName?: string;
  dateClassName?: string;
};

// Ticking clock for the home hero. Null state keeps the server HTML and the
// first client render identical, so there is no hydration mismatch.
export function LiveClock({
  className = "",
  timeClassName = "text-3xl font-bold tabular-nums tracking-tight",
  dateClassName = "text-sm opacity-70",
}: LiveClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Sync once on mount, then tick every second.
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
    // Empty deps on purpose: depending on `now` here would re-run this
    // effect on every tick and loop forever (React error #185).
  }, []);

  const time = now ? timeFmt.format(now) : "--.--.--";
  const date = now ? `${dateFmt.format(now)} WIB` : "\u00A0";

  return (
    <div className={className}>
      <div className={timeClassName}>{time}</div>
      <div className={dateClassName}>{date}</div>
    </div>
  );
}

export default LiveClock;
