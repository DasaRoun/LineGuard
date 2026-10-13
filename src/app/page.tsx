"use client";
// 시작 화면: 상황실 장애건 등록 / 접속코드 + 이름으로 참여
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { backendReady, getBackend } from "@/backend";
import { loadSession, saveSession, type Session } from "@/lib/session";

export default function Home() {
  const router = useRouter();
  const ready = backendReady();
  const [prev, setPrev] = useState<Session | null>(null);
  const [title, setTitle] = useState("");
  const [hqName, setHqName] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"field" | "hq">("field");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPrev(loadSession());
    const q = new URLSearchParams(location.search).get("code");
    if (q) setCode(q);
  }, []);

  const go = (s: Session) => router.push(`/${s.mode}/?i=${s.incidentId}`);

  const create = async () => {
    if (!title.trim() || !hqName.trim()) return alert("장애건명과 이름을 입력하세요.");
    setBusy(true);
    try {
      const { incidentId, code } = await getBackend().createIncident({ title: title.trim(), ownerName: hqName.trim() });
      const s: Session = { incidentId, code, name: hqName.trim(), mode: "hq" };
      saveSession(s);
      go(s);
    } catch (e) {
      alert(`등록 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    if (!/^\d{6}$/.test(code.trim())) return alert("접속코드 6자리 숫자를 입력하세요.");
    if (!name.trim()) return alert("이름을 입력하세요.");
    setBusy(true);
    try {
      const incidentId = await getBackend().joinIncident(code.trim(), name.trim());
      const same = prev?.incidentId === incidentId;
      const s: Session = { incidentId, code: code.trim(), name: name.trim(), mode, dispatchId: same ? prev?.dispatchId : null };
      saveSession(s);
      go(s);
    } catch (e) {
      alert(`참여 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-8">
      <header className="mb-6 text-center">
        <div className="text-4xl font-black tracking-tight">
          <span className="text-sky-400">Line</span>Guard
        </div>
        <div className="mt-1 text-slate-400">통신 선로 단선장애 긴급복구 협업 관제</div>
      </header>

      {!ready.ok && (
        <div className="mb-6 rounded-xl border border-amber-500 bg-amber-950/50 p-4 text-amber-200 text-sm">
          ⚙️ {ready.reason}
          <br />
          <code>.env.example</code> 을 <code>.env.local</code> 로 복사한 뒤 Firebase/Kakao 키를 입력하고 다시 실행하세요. (README 참고)
        </div>
      )}

      {prev && (
        <button onClick={() => go(prev)} className="mb-6 w-full rounded-2xl bg-emerald-700 hover:bg-emerald-600 p-4 text-left">
          <div className="text-lg font-bold">↩ 이어서 접속</div>
          <div className="text-sm text-emerald-100">
            {prev.name} · {prev.mode === "hq" ? "상황실" : "현장"} · 접속코드 {prev.code}
          </div>
        </button>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* 참여 */}
        <section className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5 space-y-3">
          <h2 className="text-xl font-bold">👷 장애건 참여</h2>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="접속코드 6자리"
            className="w-full rounded-xl bg-slate-900 border border-slate-600 p-4 text-center text-3xl tracking-[0.4em] font-bold"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="w-full rounded-xl bg-slate-900 border border-slate-600 p-4 text-lg"
          />
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["field", "📱 현장 작업자"],
                ["hq", "🖥️ 상황실"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} className={`rounded-xl p-3 font-bold ${mode === k ? "bg-blue-600" : "bg-slate-700"}`}>
                {l}
              </button>
            ))}
          </div>
          <button disabled={busy || !ready.ok} onClick={join} className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 p-4 text-xl font-black disabled:opacity-40">
            참여하기
          </button>
        </section>

        {/* 등록 */}
        <section className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5 space-y-3">
          <h2 className="text-xl font-bold">🚨 새 장애 등록 (상황실)</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="장애건명 (예: ○○국-△△국 간 광케이블 단선)"
            className="w-full rounded-xl bg-slate-900 border border-slate-600 p-4"
          />
          <input
            value={hqName}
            onChange={(e) => setHqName(e.target.value)}
            placeholder="등록자 이름"
            className="w-full rounded-xl bg-slate-900 border border-slate-600 p-4"
          />
          <p className="text-xs text-slate-400">등록하면 6자리 접속코드가 발급되고 A·B·C·D 지점이 기본 생성됩니다. 접속코드를 현장에 전달하세요.</p>
          <button disabled={busy || !ready.ok} onClick={create} className="w-full rounded-xl bg-red-600 hover:bg-red-500 p-4 text-xl font-black disabled:opacity-40">
            장애 등록
          </button>
        </section>
      </div>
    </main>
  );
}
