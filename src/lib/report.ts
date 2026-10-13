"use client";
// ─────────────────────────────────────────────────────────────
// 복구 결과 보고서 (엑셀 .xlsx) — 브라우저에서 직접 생성
// 원천 데이터: 이력 메시지 + 출동자 현재 상태 + 연동 입력창
// ─────────────────────────────────────────────────────────────
import type { Backend, Dispatch, Incident, Message, Site } from "@/backend";
import { SHARED_FIELDS, SIGNAL_ROLES, WORK_STEPS } from "./constants";
import { diffMin, etaTime, hhmm, ymdhm } from "./time";

type ExcelJSType = typeof import("exceljs");

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } } as const;
const BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
} as const;

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(b);
  });
}

export async function generateReport(
  be: Backend,
  incident: Incident,
  sites: Site[],
  dispatches: Dispatch[],
  messages: Message[],
  onProgress?: (msg: string) => void
) {
  const ExcelJS: ExcelJSType = (await import("exceljs")).default as unknown as ExcelJSType;
  const wb = new ExcelJS.Workbook();
  wb.creator = "LineGuard";
  wb.created = new Date();
  const siteName = (code?: string | null) => {
    const s = sites.find((x) => x.code === code);
    return s ? `${s.code}지점${s.name ? `(${s.name})` : ""}` : code ? `${code}지점` : "";
  };

  const table = (ws: import("exceljs").Worksheet, headers: string[], widths: number[]) => {
    ws.columns = headers.map((h, i) => ({ header: h, width: widths[i] ?? 14 }));
    const hr = ws.getRow(1);
    hr.eachCell((c) => {
      c.fill = HEADER_FILL as never;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = BORDER as never;
    });
    hr.height = 22;
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  const finish = (ws: import("exceljs").Worksheet) =>
    ws.eachRow((row, n) => {
      if (n === 1) return;
      row.eachCell({ includeEmpty: true }, (c) => {
        c.border = BORDER as never;
        c.alignment = { vertical: "middle", wrapText: true };
      });
    });

  const firstAt = messages[0]?.clientAt ?? incident.createdAt;
  const doneTimes = dispatches.flatMap((d) => [d.cutWork?.steps?.["복구완료"], d.switchWork?.steps?.["복구완료"]]).filter(Boolean) as number[];
  const recoveredAt = doneTimes.length ? Math.max(...doneTimes) : null;

  // 1. 개요
  onProgress?.("개요 작성 중…");
  const s1 = wb.addWorksheet("1.개요");
  s1.columns = [{ width: 24 }, { width: 70 }];
  s1.mergeCells("A1:B1");
  s1.getCell("A1").value = "통신 선로 단선장애 긴급복구 결과 보고서";
  s1.getCell("A1").font = { bold: true, size: 16 };
  s1.getCell("A1").alignment = { horizontal: "center" };
  const rows1: [string, string][] = [
    ["장애건명", incident.title],
    ["접속코드", incident.code],
    ["상위국", incident.upperStation || ""],
    ["하위국", incident.lowerStation || ""],
    ["단선구역(모식도)", incident.breakAfter ? (incident.breakAfter === "UPPER" ? "상위국 ~ 첫 지점" : `${siteName(incident.breakAfter)} 다음 구간`) : ""],
    ...SHARED_FIELDS.map((f) => [f.label, incident.fields?.[f.key] ?? ""] as [string, string]),
    ["장애 등록", ymdhm(incident.createdAt)],
    ["최초 기록", ymdhm(firstAt)],
    ["복구완료", recoveredAt ? ymdhm(recoveredAt) : "미완료"],
    ["총 소요시간", recoveredAt ? `${diffMin(incident.createdAt, recoveredAt)}분` : ""],
    ["지점 수", String(sites.length)],
    ["출동 인원(누적)", `${dispatches.length}명`],
    ["보고서 생성", ymdhm(Date.now())],
  ];
  rows1.forEach(([k, v]) => {
    const r = s1.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    r.eachCell((c) => {
      c.border = BORDER as never;
      c.alignment = { vertical: "middle", wrapText: true };
    });
  });

  // 2. 출동현황
  onProgress?.("출동현황 작성 중…");
  const s2 = wb.addWorksheet("2.출동현황");
  table(s2, ["지점", "이름", "역할", "출동", "도착소요(분)", "예상도착", "도착", "이동소요(분)", "현장소요(분)", "상태", "철수", "현재 상태값", "메모"], [22, 10, 12, 8, 10, 9, 8, 10, 10, 8, 8, 30, 24]);
  const sortedD = [...dispatches].sort((a, b) => a.siteCode.localeCompare(b.siteCode) || a.departAt - b.departAt);
  for (const d of sortedD) {
    const end = d.withdrawnAt ?? recoveredAt ?? Date.now();
    s2.addRow([
      siteName(d.siteCode),
      d.name,
      d.role,
      hhmm(d.departAt),
      d.etaMin ?? "",
      hhmm(etaTime(d.departAt, d.etaMin)),
      hhmm(d.arriveAt),
      diffMin(d.departAt, d.arriveAt) ?? "",
      d.arriveAt ? diffMin(d.arriveAt, end) ?? "" : "",
      d.phase === "moving" ? "이동중" : d.phase === "arrived" ? "현장" : "철수",
      hhmm(d.withdrawnAt),
      d.statuses.join(", "),
      d.memo,
    ]);
  }
  finish(s2);

  // 3. 작업타임라인 (전체 이력)
  onProgress?.("타임라인 작성 중…");
  const s3 = wb.addWorksheet("3.작업타임라인");
  table(s3, ["일시", "지점", "작성자", "역할", "구분", "내용"], [17, 20, 10, 12, 10, 70]);
  for (const m of messages) {
    const kind = m.type === "chat" ? "채팅" : m.type === "voice" ? "무전" : m.type === "photo" ? "사진" : m.type === "video" ? "동영상" : m.category;
    const content = m.type === "voice" ? `🎙 ${m.sttText ?? "(음성)"}` : m.type === "photo" || m.type === "video" ? `${m.text || ""} [첨부]` : m.text;
    s3.addRow([ymdhm(m.clientAt), siteName(m.siteCode), m.authorName, m.role ?? "", kind, content]);
  }
  finish(s3);

  // 4. 안전점검 (신호수 중심)
  onProgress?.("안전점검 작성 중…");
  const s4 = wb.addWorksheet("4.안전점검");
  table(s4, ["지점", "이름", "역할", "도착", "안전조치완료(단선)", "안전조치완료(절체)", "위험개소확인", "경고 상태"], [22, 10, 12, 8, 16, 16, 14, 34]);
  const safetyTargets = dispatches.filter((d) => SIGNAL_ROLES.includes(d.role) || d.cutWork?.steps?.["안전조치완료"] || d.switchWork?.steps?.["안전조치완료"]);
  for (const d of safetyTargets) {
    const riskMsg = messages.find((m) => m.dispatchId === d.id && m.category === "상태" && m.text.startsWith("위험개소확인중"));
    s4.addRow([
      siteName(d.siteCode),
      d.name,
      d.role,
      hhmm(d.arriveAt),
      hhmm(d.cutWork?.steps?.["안전조치완료"]),
      hhmm(d.switchWork?.steps?.["안전조치완료"]),
      riskMsg ? hhmm(riskMsg.clientAt) : "",
      d.statuses.filter((s) => ["화재진입불가", "침수진입불가", "한전작업중", "작업중지권발행"].includes(s)).join(", "),
    ]);
  }
  s4.addRow([]);
  const stopRow = s4.addRow(["작업중지권 발행/해제 이력"]);
  stopRow.font = { bold: true };
  for (const m of messages.filter((x) => x.category === "상태" && x.text.includes("작업중지권"))) {
    s4.addRow([siteName(m.siteCode), m.authorName, m.role ?? "", hhmm(m.clientAt), m.text]);
  }
  finish(s4);

  // 5. OTDR·작업·함체
  onProgress?.("OTDR·함체 작성 중…");
  const s5 = wb.addWorksheet("5.OTDR·작업·함체");
  table(
    s5,
    ["지점", "이름", "단선지점확인", "OTDR 긍장(m)", "광소스", "광신호", "단선작업 신호", ...WORK_STEPS.map((s) => `단선:${s}`), "절체작업 신호", ...WORK_STEPS.map((s) => `절체:${s}`), "함체A", "함체B"],
    [22, 10, 12, 12, 12, 12, 12, 10, 10, 10, 10, 10, 12, 10, 10, 10, 10, 10, 24, 24]
  );
  for (const d of sortedD) {
    s5.addRow([
      siteName(d.siteCode),
      d.name,
      hhmm(d.breakConfirmedAt),
      d.otdr?.lengthM ?? "",
      d.otdr?.source ?? "",
      d.otdr?.signal ?? "",
      d.cutWork?.signal ?? "",
      ...WORK_STEPS.map((s) => hhmm(d.cutWork?.steps?.[s]).replace("--:--", "")),
      d.switchWork?.signal ?? "",
      ...WORK_STEPS.map((s) => hhmm(d.switchWork?.steps?.[s]).replace("--:--", "")),
      (d.closure?.A ?? []).join(", "),
      (d.closure?.B ?? []).join(", "),
    ]);
  }
  finish(s5);

  // 6. 사진대장
  const s6 = wb.addWorksheet("6.사진대장");
  table(s6, ["사진", "일시", "지점", "촬영자", "구분", "설명", "좌표", "원본"], [42, 17, 20, 10, 10, 30, 22, 12]);
  const media = messages.filter((m) => (m.type === "photo" || m.type === "video") && m.mediaUrl);
  let failed = 0;
  for (let i = 0; i < media.length; i++) {
    const m = media[i];
    onProgress?.(`사진 ${i + 1}/${media.length} 삽입 중…`);
    const row = s6.addRow([
      "",
      ymdhm(m.clientAt),
      siteName(m.siteCode),
      m.authorName,
      m.isBreakPoint ? "단선지점" : m.category,
      m.text,
      m.lat != null ? `${m.lat.toFixed(6)}, ${m.lng?.toFixed(6)}` : "",
      { text: "열기", hyperlink: m.mediaUrl! },
    ]);
    row.height = 170;
    if (m.type === "photo" && m.mediaPath) {
      const blob = await be.fetchMedia(m.mediaPath);
      if (blob) {
        const ext = blob.type.includes("png") ? "png" : "jpeg";
        const id = wb.addImage({ base64: await blobToBase64(blob), extension: ext });
        s6.addImage(id, { tl: { col: 0.1, row: row.number - 1 + 0.1 }, ext: { width: 290, height: 218 }, editAs: "oneCell" });
      } else {
        failed++;
        row.getCell(1).value = "(이미지 불러오기 실패 — 원본 링크 참조)";
      }
    } else if (m.type === "video") {
      row.getCell(1).value = "🎬 동영상 (원본 링크 참조)";
      row.height = 30;
    }
  }
  finish(s6);

  // 7. 지시이력
  const s7 = wb.addWorksheet("7.지시이력");
  table(s7, ["일시", "발령자", "대상 지점", "내용", "구분"], [17, 10, 20, 60, 8]);
  for (const m of messages.filter((x) => x.category === "지시")) {
    s7.addRow([ymdhm(m.clientAt), m.authorName, siteName(m.siteCode), m.text, String(m.data?.phase ?? "")]);
  }
  finish(s7);

  onProgress?.("파일 저장 중…");
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  a.href = URL.createObjectURL(blob);
  a.download = `복구보고서_${incident.title.replace(/[\\/:*?"<>|]/g, "_")}_${stamp}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return { photoFailed: failed };
}
