import type { NextConfig } from "next";

// GitHub Pages 배포 시 저장소 이름이 경로(/LineGuard)가 되므로 basePath를 환경변수로 받습니다.
// 로컬 개발/노트북 서버에서는 비워 둡니다.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export", // 정적 파일(out/)로 내보내기 → GitHub Pages / 노트북 서버 어디서나 서비스 가능
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
