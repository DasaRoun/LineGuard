// 사진 압축 / 현재 위치 1회 조회

/** 긴 변 maxSide 픽셀로 축소한 JPEG Blob 반환 (현장 데이터 절약) */
export async function compressImage(file: File, maxSide = 2560, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy: number;
}

/** 현재 위치 1회 조회 (권한 거부/실패 시 null) */
export function getCurrentPosition(timeoutMs = 10000): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15000 }
    );
  });
}

export function extOf(blob: Blob, fallback: string) {
  const t = blob.type;
  if (t.includes("jpeg")) return "jpg";
  if (t.includes("png")) return "png";
  if (t.includes("webm")) return "webm";
  if (t.includes("mp4")) return "mp4";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("quicktime")) return "mov";
  return fallback;
}
