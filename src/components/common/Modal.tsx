"use client";
import type { ReactNode } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-auto rounded-2xl bg-slate-800 border border-slate-600 shadow-2xl ${
          wide ? "max-w-5xl" : "max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between bg-slate-800 border-b border-slate-700 px-4 py-3">
          <div className="font-bold">{title}</div>
          <button onClick={onClose} className="rounded-lg bg-slate-700 px-3 py-1 text-lg" aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
