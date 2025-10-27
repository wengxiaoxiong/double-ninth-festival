"use client";

import Image from "next/image";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

type ShareRecord = {
  id: number;
  originalUrl: string;
  restoredUrl: string;
  status: string;
  createdAt: string;
};

export default function SharePage({ params }: { params: Promise<{ recordId: string }> }) {
  const [record, setRecord] = useState<ShareRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  const resolvedParams = use(params);

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const response = await fetch(`/api/share/${resolvedParams.recordId}`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          setError(data.error || "记录不存在");
          return;
        }
        
        setRecord(data.data);
      } catch (err) {
        setError("加载失败，请稍后再试");
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [resolvedParams.recordId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5efdc] flex items-center justify-center">
        <div className="text-slate-800 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto mb-4"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-[#f5efdc] flex items-center justify-center">
        <div className="text-slate-800 text-center">
          <p className="text-xl mb-4">{error || "记录不存在"}</p>
          <button
            onClick={() => router.push('/')}
            className="rounded-2xl bg-slate-800 px-6 py-3 text-white shadow"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5efdc] text-slate-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        {/* Header */}
        <section className="relative overflow-hidden rounded-3xl shadow-2xl">
          <Image
            src="/banner.jpg"
            alt="重阳节 AI 照片焕新活动"
            width={1200}
            height={400}
            className="h-[180px] w-full object-cover sm:h-[240px]"
            priority
          />

        </section>

        {/* 修复效果展示 */}
        <section className="relative rounded-3xl bg-white/95 p-6 text-slate-900 shadow-xl backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">修复效果对比</h2>
              <p className="mt-2 text-sm text-slate-500">
                记录编号：{record.id} · {new Date(record.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <figure className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="rounded-xl bg-slate-100 p-2">
                  <img src={record.originalUrl} alt="原始老照片" className="h-64 w-full rounded-lg object-cover" />
                </div>
                <figcaption className="text-center text-sm font-medium text-slate-600">原始照片</figcaption>
              </figure>
              <figure className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="rounded-xl bg-slate-100 p-2">
                  <img src={record.restoredUrl} alt="修复后照片" className="h-64 w-full rounded-lg object-cover" />
                </div>
                <figcaption className="text-center text-sm font-medium text-slate-600">修复后照片</figcaption>
              </figure>
            </div>

            {/* CTA按钮 */}
            <div className="flex flex-col gap-4 items-center">
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href={record.restoredUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500"
                >
                  下载修复照片
                </a>
              </div>

              {/* 我也要修复按钮 */}
              <div className="w-full rounded-2xl bg-gradient-to-r from-orange-50 to-yellow-50 p-6 border border-orange-200">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">你也有老照片需要修复吗？</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    使用同样的AI技术，让珍贵回忆重新焕发光彩
                  </p>
                  <button
                    onClick={() => router.push('/')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-orange-600"
                  >
                    <span className="text-xl">✨</span>
                    我也要修复老照片
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 特色介绍 */}
        <section className="relative rounded-3xl bg-white/90 p-6 text-slate-900 shadow-xl backdrop-blur">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">AI修复特色</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl mb-2">🎯</div>
                <h4 className="font-medium text-sm">真人质感</h4>
                <p className="text-xs text-slate-600">保持人物特征自然</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">🔍</div>
                <h4 className="font-medium text-sm">高清修复</h4>
                <p className="text-xs text-slate-600">去除噪点和模糊</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">⚡</div>
                <h4 className="font-medium text-sm">一键保存</h4>
                <p className="text-xs text-slate-600">快速下载高清图片</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
