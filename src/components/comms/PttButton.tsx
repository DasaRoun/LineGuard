"use client";
// 스마트 무전 PTT — 누르고 있는 동안 녹음, 손을 떼면 음성클립 + 음성인식(STT) 텍스트를 채팅에 전송
import { useEffect, useRef, useState } from "react";
import { playChirp, playRoger, startStt, unlockAudio } from "@/lib/audio";
import { sendVoice, type Actor } from "@/lib/actions";

let sharedStream: MediaStream | null = null;
async function getMic() {
  if (sharedStream && sharedStream.getAudioTracks().some((t) => t.readyState === "live")) return sharedStream;
  sharedStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  return sharedStream;
}

function pickMime() {
  const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return cands.find((c) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) ?? "";
}

export default function PttButton({ actor, size = "big", hotkey = false }: { actor: Actor; size?: "big" | "small"; hotkey?: boolean }) {
  const [state, setState] = useState<"idle" | "rec" | "sending">("idle");
  const [sec, setSec] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sttRef = useRef<ReturnType<typeof startStt>>(null);
  const startAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const actorRef = useRef(actor);
  actorRef.current = actor;

  const start = async () => {
    if (state !== "idle") return;
    unlockAudio();
    try {
      const stream = await getMic();
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.start(250);
      recRef.current = rec;
      startAtRef.current = Date.now();
      setSec(0);
      timerRef.current = setInterval(() => setSec(Math.floor((Date.now() - startAtRef.current) / 1000)), 250);
      playChirp();
      sttRef.current = startStt();
      navigator.vibrate?.(60);
      setState("rec");
    } catch (e) {
      alert(`마이크를 사용할 수 없습니다: ${(e as Error).message}\n브라우저 마이크 권한을 허용해 주세요.`);
    }
  };

  const stop = async () => {
    const rec = recRef.current;
    if (!rec || state !== "rec") return;
    recRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    const duration = (Date.now() - startAtRef.current) / 1000;
    const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.stop();
    playRoger();
    navigator.vibrate?.([30, 40, 30]);
    setState("sending");
    try {
      const [, text] = await Promise.all([stopped, sttRef.current?.stop() ?? Promise.resolve("")]);
      if (duration < 0.6) return; // 너무 짧은 오작동 터치는 버림
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      await sendVoice(actorRef.current, blob, text, Math.round(duration));
    } catch (e) {
      alert(`무전 전송 실패: ${(e as Error).message}`);
    } finally {
      setState("idle");
    }
  };

  // 상황실 PC: 스페이스바 누르고 있기 = PTT (입력창 포커스 중엔 무시)
  useEffect(() => {
    if (!hotkey) return;
    const isTyping = () => {
      const t = document.activeElement?.tagName;
      return t === "INPUT" || t === "TEXTAREA" || t === "SELECT";
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isTyping()) {
        e.preventDefault();
        void start();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping()) {
        e.preventDefault();
        void stop();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  const big = size === "big";
  const color = state === "rec" ? "bg-red-600 ring-8 ring-red-500/40 animate-pulse" : state === "sending" ? "bg-amber-600" : "bg-emerald-600 active:bg-emerald-500";
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        void start();
      }}
      onPointerUp={() => void stop()}
      onPointerCancel={() => void stop()}
      onContextMenu={(e) => e.preventDefault()}
      className={`select-none touch-none rounded-2xl font-black text-white shadow-lg transition ${color} ${
        big ? "h-24 w-full text-2xl" : "px-4 py-2 text-sm"
      }`}
      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
    >
      {state === "rec" ? `🔴 송신 중 ${sec}초` : state === "sending" ? "전송 중…" : big ? "🎙️ 누르고 말하기 (PTT)" : `🎙️ PTT${hotkey ? " (Space)" : ""}`}
    </button>
  );
}
