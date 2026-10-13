// ─────────────────────────────────────────────────────────────
// 저장소 선택기 — NEXT_PUBLIC_BACKEND 값에 따라 구현체를 고릅니다.
//   firebase : 1차 (현재)
//   local    : 2차 노트북 서버 (docs/노트북서버_전환가이드.md 참고)
// ─────────────────────────────────────────────────────────────
import type { Backend } from "./types";
import { firebaseBackend, isFirebaseConfigured } from "./firebase";

const kind = process.env.NEXT_PUBLIC_BACKEND || "firebase";

export function getBackend(): Backend {
  switch (kind) {
    // case "local":
    //   return localBackend;   // 노트북 서버 전환 시 주석 해제
    case "firebase":
    default:
      return firebaseBackend;
  }
}

export function backendReady(): { ok: boolean; reason?: string } {
  if (kind === "firebase" && !isFirebaseConfigured()) {
    return { ok: false, reason: "Firebase 설정값(.env.local)이 비어 있습니다." };
  }
  return { ok: true };
}

export * from "./types";
