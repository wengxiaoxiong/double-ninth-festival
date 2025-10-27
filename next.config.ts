import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  // 确保在生产环境中正确处理文件上传
  serverRuntimeConfig: {
    // 增加文件上传大小限制
    maxFileSize: '15mb',
  },
  // 配置 API 路由
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default nextConfig;
