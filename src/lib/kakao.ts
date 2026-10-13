"use client";
// Kakao 지도 SDK 동적 로더 (JavaScript 키 1개만 사용, services 라이브러리로 지번/주소/키워드 검색)
/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    kakao: any;
  }
}

let loading: Promise<any> | null = null;

export function kakaoKeyConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
}

export function loadKakao(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저 전용"));
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao);
  if (loading) return loading;
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key) return Promise.reject(new Error("Kakao JavaScript 키가 설정되지 않았습니다 (.env.local)"));
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`;
    s.async = true;
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    s.onerror = () => {
      loading = null;
      reject(new Error("Kakao 지도 로드 실패 — 키 또는 등록 도메인을 확인하세요."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export interface SearchResult {
  title: string;
  address: string;
  lat: number;
  lng: number;
  kind: "지번" | "도로명" | "장소";
}

/** 지번·도로명 주소 검색 + 장소(키워드) 검색 통합 */
export async function searchPlace(q: string): Promise<SearchResult[]> {
  const kakao = await loadKakao();
  const geocoder = new kakao.maps.services.Geocoder();
  const places = new kakao.maps.services.Places();
  const byAddress = new Promise<SearchResult[]>((resolve) => {
    geocoder.addressSearch(q, (res: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK) return resolve([]);
      resolve(
        res.map((r) => {
          const jibun = r.address?.address_name;
          const road = r.road_address?.address_name;
          return {
            title: jibun || road || r.address_name,
            address: road && jibun ? `도로명: ${road}` : r.address_name,
            lat: Number(r.y),
            lng: Number(r.x),
            kind: r.address_type === "ROAD_ADDR" ? "도로명" : "지번",
          } as SearchResult;
        })
      );
    });
  });
  const byKeyword = new Promise<SearchResult[]>((resolve) => {
    places.keywordSearch(q, (res: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK) return resolve([]);
      resolve(
        res.slice(0, 10).map((r) => ({
          title: r.place_name,
          address: r.address_name || r.road_address_name,
          lat: Number(r.y),
          lng: Number(r.x),
          kind: "장소",
        }))
      );
    });
  });
  const [a, b] = await Promise.all([byAddress, byKeyword]);
  return [...a, ...b];
}

/** 좌표 → 지번 주소 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const kakao = await loadKakao();
  const geocoder = new kakao.maps.services.Geocoder();
  return new Promise((resolve) => {
    geocoder.coord2Address(lng, lat, (res: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK || !res[0]) return resolve("");
      resolve(res[0].address?.address_name || res[0].road_address?.address_name || "");
    });
  });
}
