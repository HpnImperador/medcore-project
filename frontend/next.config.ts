import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: false,
  },
  // Permite que o servidor aceite conexões do seu IP de rede
  experimental: {
    allowedDevOrigins: ["192.168.0.109", "localhost:3001"]
  }
};

export default nextConfig;
