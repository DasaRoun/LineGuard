"use client";
import type { Message } from "@/backend";
import { ymdhm } from "@/lib/time";
import Modal from "./Modal";

/** 사진/동영상 원본 확대 보기 */
export default function MediaViewer({ msg, onClose }: { msg: Message | null; onClose: () => void }) {
  return (
    <Modal open={!!msg} onClose={onClose} title={msg?.isBreakPoint ? "📍 단선지점 사진" : "현장 채증"} wide>
      {msg && (
        <div className="space-y-3">
          {msg.type === "video" ? (
            <video src={msg.mediaUrl ?? ""} controls className="w-full max-h-[70vh] rounded-lg bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={msg.mediaUrl ?? ""} alt={msg.text} className="w-full max-h-[70vh] object-contain rounded-lg bg-black" />
          )}
          <div className="text-sm text-slate-300 space-y-1">
            <div>
              <b>{msg.authorName}</b> {msg.role ? `(${msg.role})` : ""} · {msg.siteCode ? `${msg.siteCode}지점` : ""} ·{" "}
              {ymdhm(msg.clientAt)}
            </div>
            {msg.text && <div>{msg.text}</div>}
            {msg.lat != null && (
              <div className="text-slate-400">
                좌표 {msg.lat.toFixed(6)}, {msg.lng?.toFixed(6)}
              </div>
            )}
            <a href={msg.mediaUrl ?? "#"} target="_blank" rel="noreferrer" className="text-blue-400 underline">
              원본 새 창으로 열기
            </a>
          </div>
        </div>
      )}
    </Modal>
  );
}
