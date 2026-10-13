"use client";
// ✏️ 직접입력 공통 컴포넌트 — 연필 버튼 → 입력창 → [저장]
import { useEffect, useState } from "react";

interface Props {
  label?: string;
  value: string;
  placeholder?: string;
  onSave: (v: string) => Promise<void> | void;
  multiline?: boolean;
  chips?: string[]; // 자주 쓰는 값 (누르면 입력창에 채움)
  inputMode?: "text" | "numeric" | "decimal";
  suffix?: string;
  big?: boolean; // 현장용 큰 글씨
  emptyText?: string;
  className?: string;
}

export default function EditableField({
  label,
  value,
  placeholder,
  onSave,
  multiline,
  chips,
  inputMode = "text",
  suffix,
  big,
  emptyText = "미입력",
  className = "",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (e) {
      alert(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const text = big ? "text-lg" : "text-sm";

  return (
    <div className={`${className}`}>
      {label && <div className="text-xs text-slate-400 mb-1">{label}</div>}
      {!editing ? (
        <div className="flex items-start gap-2">
          <div className={`flex-1 ${text} whitespace-pre-wrap break-all ${value ? "text-slate-100" : "text-slate-500 italic"}`}>
            {value ? `${value}${suffix ? ` ${suffix}` : ""}` : emptyText}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`shrink-0 rounded-lg bg-slate-700 hover:bg-slate-600 ${big ? "px-4 py-3 text-lg" : "px-2 py-1 text-sm"}`}
            aria-label={`${label ?? ""} 직접입력`}
            title="직접입력"
          >
            ✏️
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {chips && (
            <div className="flex flex-wrap gap-1">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft((d) => (d ? `${d} ${c}` : c))}
                  className="rounded-full bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {multiline ? (
              <textarea
                autoFocus
                value={draft}
                placeholder={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className={`flex-1 rounded-lg bg-slate-900 border border-slate-600 p-2 ${text}`}
              />
            ) : (
              <input
                autoFocus
                value={draft}
                inputMode={inputMode}
                placeholder={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                  if (e.key === "Escape") setEditing(false);
                }}
                className={`flex-1 min-w-0 rounded-lg bg-slate-900 border border-slate-600 ${big ? "p-3" : "p-2"} ${text}`}
              />
            )}
            {suffix && <span className="text-slate-400">{suffix}</span>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className={`flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold disabled:opacity-50 ${big ? "py-3 text-lg" : "py-1.5 text-sm"}`}
            >
              {saving ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
              className={`rounded-lg bg-slate-700 px-4 ${big ? "py-3 text-lg" : "py-1.5 text-sm"}`}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
