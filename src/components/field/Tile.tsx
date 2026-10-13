"use client";
// 현장용 큰 버튼 (장갑 착용 기준 최소 64px)
import type { ReactNode } from "react";

export function Tile({
  children,
  on,
  onClick,
  tone = "blue",
  sub,
  disabled,
  className = "",
}: {
  children: ReactNode;
  on?: boolean;
  onClick?: () => void;
  tone?: "blue" | "red" | "green" | "amber" | "orange";
  sub?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-600 border-blue-300",
    red: "bg-red-600 border-red-300",
    green: "bg-emerald-600 border-emerald-300",
    amber: "bg-amber-500 border-amber-200 text-slate-900",
    orange: "bg-orange-600 border-orange-300",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-16 rounded-xl border-2 px-2 py-2 text-base font-bold leading-tight transition active:scale-95 disabled:opacity-40 ${
        on ? `${tones[tone]} shadow-lg` : "bg-slate-800 border-slate-600 text-slate-200"
      } ${className}`}
    >
      <div>{children}</div>
      {sub && <div className="mt-0.5 text-xs font-normal opacity-90">{sub}</div>}
    </button>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
      <div className="mb-2 flex items-center">
        <h3 className="text-lg font-black">{title}</h3>
        <span className="flex-1" />
        {right}
      </div>
      {children}
    </section>
  );
}
