"use client";

import { useEffect, useRef, useState } from "react";

function useCountUp(target: number, decimals: number, start: boolean, duration = 1600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Number((target * eased).toFixed(decimals)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target, decimals, duration]);
  return value;
}

function CounterItem({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  label,
  start,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
  start: boolean;
}) {
  const v = useCountUp(value, decimals, start);
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
        {prefix}
        {v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
        {suffix}
      </div>
      <div className="text-xs text-muted-foreground sm:text-sm">{label}</div>
    </div>
  );
}

export function Counters({ stats }: { stats: Array<{ value: number; prefix?: string; suffix?: string; label: string; decimals?: number }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStart(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <CounterItem key={s.label} {...s} start={start} />
      ))}
    </div>
  );
}