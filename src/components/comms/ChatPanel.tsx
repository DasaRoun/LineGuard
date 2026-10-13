"use client";
// 채팅/무전/사진/이력 타임라인 + 입력창(음성받아쓰기) + 수신무전 자동재생 + TTS
import { useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "@/backend";
import { sendChat, type Actor } from "@/lib/actions";
import { speak, startStt, sttSupported, unlockAudio } from "@/lib/audio";
import { hhmm } from "@/lib/time";
import { roleColor } from "../map/MapPanel";

type Filter = "all" | "talk" | "media" | "event";

export default function ChatPanel({
  actor,
  messages,
  myUid,
  onMediaClick,
  big,
  className = "",
}: {
  actor: Actor;
  messages: Message[];
  myUid: string | null;
  onMediaClick: (m: Message) => void;
  big?: boolean;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [autoPlay, setAutoPlay] = useState(false);
  const [tts, setTts] = useState(false);
  const [dictating, setDictating] = useState(false);
  const dictRef = useRef<ReturnType<typeof startStt>>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mountAt = useRef(Date.now());
  const handled = useRef(new Set<string>());
  const queue = useRef<string[]>([]);
  const playing = useRef(false);

  const list = useMemo(() => {
    switch (filter) {
      case "talk":
        return messages.filter((m) => m.type === "chat" || m.type === "voice");
      case "media":
        return messages.filter((m) => m.type === "photo" || m.type === "video");
      case "event":
        return messages.filter((m) => m.type === "event");
      default:
        return messages;
    }
  }, [messages, filter]);

  // 새 메시지 → 맨 아래로 스크롤
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list.length]);

  // 수신 무전 자동재생 / 새 메시지 TTS
  useEffect(() => {
    for (const m of messages) {
      if (handled.current.has(m.id)) continue;
      handled.current.add(m.id);
      if (m.clientAt < mountAt.current || m.authorUid === myUid) continue;
      if (autoPlay && m.type === "voice" && m.mediaUrl) {
        queue.current.push(m.mediaUrl);
        playNext();
      } else if (tts && (m.type === "chat" || (m.type === "event" && m.category === "지시"))) {
        speak(`${m.authorName}. ${m.text}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, autoPlay, tts, myUid]);

  const playNext = () => {
    if (playing.current) return;
    const url = queue.current.shift();
    if (!url) return;
    playing.current = true;
    const a = new Audio(url);
    a.onended = a.onerror = () => {
      playing.current = false;
      playNext();
    };
    a.play().catch(() => {
      playing.current = false;
    });
  };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      await sendChat(actor, t);
    } catch (e) {
      setText(t);
      alert(`전송 실패: ${(e as Error).message}`);
    }
  };

  const toggleDictation = async () => {
    if (!dictating) {
      const s = startStt();
      if (!s) return alert("이 브라우저는 음성인식을 지원하지 않습니다. (크롬/엣지 권장)");
      dictRef.current = s;
      setDictating(true);
    } else {
      setDictating(false);
      const t = (await dictRef.current?.stop()) ?? "";
      if (t) setText((p) => (p ? `${p} ${t}` : t));
    }
  };

  const fs = big ? "text-base" : "text-sm";

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 p-2 text-xs">
        {(
          [
            ["all", "전체"],
            ["talk", "채팅·무전"],
            ["media", "사진"],
            ["event", "이력"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-md px-2 py-1 ${filter === k ? "bg-blue-600" : "bg-slate-700"}`}>
            {l}
          </button>
        ))}
        <span className="flex-1" />
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={autoPlay}
            onChange={(e) => {
              unlockAudio();
              setAutoPlay(e.target.checked);
            }}
          />
          무전 자동재생
        </label>
        <label className="flex items-center gap-1 ml-2">
          <input type="checkbox" checked={tts} onChange={(e) => setTts(e.target.checked)} />
          음성낭독
        </label>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        {list.length === 0 && <div className="text-center text-slate-500 text-sm py-8">아직 기록이 없습니다.</div>}
        {list.map((m) => {
          const mine = m.authorUid === myUid;
          if (m.type === "event")
            return (
              <div key={m.id} className={`flex gap-2 ${fs} ${m.category === "지시" ? "text-sky-300" : m.text.includes("작업중지권") ? "text-red-400 font-bold" : "text-slate-400"}`}>
                <span className="shrink-0 tabular-nums text-slate-500">{hhmm(m.clientAt)}</span>
                <span>
                  <b className="text-slate-300">{m.authorName}</b>
                  {m.siteCode ? <span className="text-slate-500"> [{m.siteCode}]</span> : null} {m.text}
                </span>
              </div>
            );
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 ${mine ? "bg-blue-700" : "bg-slate-700"}`}>
                <div className="text-[11px] text-slate-300 mb-0.5 flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: roleColor(m.role) }} />
                  <b>{m.authorName}</b>
                  {m.role && <span>· {m.role}</span>}
                  {m.siteCode && <span>· {m.siteCode}지점</span>}
                  <span className="ml-auto pl-2 tabular-nums">{hhmm(m.clientAt)}</span>
                </div>
                {m.type === "chat" && <div className={`${fs} whitespace-pre-wrap break-all`}>{m.text}</div>}
                {m.type === "voice" && (
                  <div className="space-y-1">
                    <audio src={m.mediaUrl ?? ""} controls preload="none" className="h-9 w-56 max-w-full" />
                    <div className={`${fs} text-slate-200`}>
                      🎙️ {m.sttText ? m.sttText : <span className="text-slate-400 italic">(음성인식 텍스트 없음)</span>}
                      {typeof m.data?.durationSec === "number" && <span className="text-slate-400 text-xs"> · {String(m.data.durationSec)}초</span>}
                    </div>
                  </div>
                )}
                {(m.type === "photo" || m.type === "video") && (
                  <button onClick={() => onMediaClick(m)} className="block">
                    {m.type === "photo" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.mediaUrl ?? ""} alt="" className={`max-h-48 rounded-lg ${m.isBreakPoint ? "ring-4 ring-red-500" : ""}`} loading="lazy" />
                    ) : (
                      <video src={m.mediaUrl ?? ""} className="max-h-48 rounded-lg" preload="metadata" />
                    )}
                    {m.text && <div className={`${fs} mt-1 text-left`}>{m.text}</div>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 border-t border-slate-700 p-2">
        {sttSupported() && (
          <button
            onClick={toggleDictation}
            className={`rounded-lg px-3 ${dictating ? "bg-red-600 animate-pulse" : "bg-slate-700"} ${big ? "text-xl" : ""}`}
            title="음성으로 받아쓰기"
          >
            {dictating ? "⏹" : "🎤"}
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
          placeholder={dictating ? "말씀하세요… (끝나면 ⏹)" : "메시지 입력"}
          className={`flex-1 min-w-0 rounded-lg bg-slate-900 border border-slate-600 px-3 ${big ? "py-3 text-base" : "py-2 text-sm"}`}
        />
        <button onClick={send} className={`rounded-lg bg-blue-600 px-4 font-bold ${big ? "text-base" : "text-sm"}`}>
          전송
        </button>
      </div>
    </div>
  );
}
