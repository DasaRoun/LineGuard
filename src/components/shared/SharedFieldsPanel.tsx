"use client";
// 상황실 ↔ 현장 연동 입력창 (코어ID / 단선지점 / 단선원인 / 시공사 추가 케이블 요청)
import type { Incident } from "@/backend";
import { CAUSE_CHIPS, SHARED_FIELDS } from "@/lib/constants";
import { updateSharedField, type Actor } from "@/lib/actions";
import EditableField from "../common/EditableField";

export default function SharedFieldsPanel({ actor, incident, big }: { actor: Actor; incident: Incident; big?: boolean }) {
  return (
    <div className="space-y-3">
      {SHARED_FIELDS.map((f) => (
        <div key={f.key} className="rounded-xl bg-slate-800 border border-slate-700 p-3">
          <EditableField
            label={f.label}
            value={incident.fields?.[f.key] ?? ""}
            placeholder={f.placeholder}
            multiline={f.key === "cableRequest" || f.key === "breakCause"}
            chips={f.key === "breakCause" ? CAUSE_CHIPS : undefined}
            big={big}
            onSave={(v) => updateSharedField(actor, f.key, v)}
          />
        </div>
      ))}
    </div>
  );
}
