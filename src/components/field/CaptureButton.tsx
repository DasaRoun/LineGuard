"use client";
// 카메라 즉시 실행 버튼 (숨김 file input)
import { useRef, type ReactNode } from "react";

export default function CaptureButton({
  children,
  onFile,
  accept = "image/*",
  capture = "environment",
  className = "",
}: {
  children: ReactNode;
  onFile: (f: File) => void;
  accept?: string;
  capture?: "environment" | "user" | null;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className={className}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        {...(capture ? { capture } : {})}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </>
  );
}
