"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

type ShareRecord = {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  phone: string;
  createdAt: string;
};

export default function PoemSharePage() {
  const params = useParams();
  const recordId = params.recordId;
  
  const [record, setRecord] = useState<ShareRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) return;

    const fetchRecord = async () => {
      try {
        const response = await fetch(`/api/share/poem/${recordId}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error || "获取诗歌信息失败");
          return;
        }

        setRecord(data.data);
      } catch (err) {
        setError("网络错误，请稍后再试");
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [recordId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5efdc] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600">正在加载诗歌...</p>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-[#f5efdc] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <div className="text-6xl mb-4">😞</div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">诗歌不存在</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <Link
              href="/poem"
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-orange-500"
            >
              去创作诗歌
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5efdc] text-slate-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <Link
            href="/poem"
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            ← 我也要创作
          </Link>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-slate-800">重阳节诗歌分享</h1>
            <p className="text-sm text-slate-500">AI创作 · 诗情画意</p>
          </div>
          <div className="w-24"></div> {/* 占位符保持对称 */}
        </div>

        {/* 主要分享卡片 */}
        <section className="relative rounded-3xl bg-white/95 shadow-2xl backdrop-blur overflow-hidden">
          {/* 背景图片 */}
          {record.imageUrl && (
            <div className="relative h-80 sm:h-96">
              <img
                src={record.imageUrl}
                alt={record.title}
                className="w-full object-contain"
                style={{ maxHeight: '500px' }}
              />
            </div>
          )}

          {/* 诗歌内容 */}
          <div className="relative p-6 sm:p-8">
            {!record.imageUrl && (
              <div className="h-32 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl mb-6 flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="text-4xl mb-2">🌼</div>
                  <div className="text-lg font-serif">重阳节快乐</div>
                </div>
              </div>
            )}

            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6 font-serif">
                {record.title}
              </h2>

              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 mb-6 border border-yellow-200">
                <div className="text-slate-700 text-lg sm:text-xl leading-relaxed whitespace-pre-line font-serif">
                  {record.content}
                </div>
              </div>

              {/* 分享信息 */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500 border-t border-slate-200 pt-4">
                <div className="flex items-center gap-4">
                  <span>📱 {record.phone}</span>
                  <span>📅 {new Date(record.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>🤖</span>
                  <span>AI创作</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 行动按钮 */}
        <section className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/poem"
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-orange-500"
          >
            ✨ 我也要创作诗歌
          </Link>
          
          <Link
            href="/photo"
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-indigo-500"
          >
            📸 AI修复老照片
          </Link>
        </section>

        {/* 重阳节介绍 */}
        <section className="rounded-2xl bg-gradient-to-r from-yellow-50 to-orange-50 p-6 border border-yellow-200">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">九九重阳节</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              重阳节，又称登高节、菊花节，是中华民族的传统节日。<br />
              在这个特殊的日子里，让AI帮您创作诗歌、修复老照片，<br />
              用科技传承文化，用温情连接亲情。
            </p>
          </div>
        </section>

        {/* 分享按钮 */}
        <section className="text-center">
          <button
            onClick={() => {
              const shareText = `${record.title}\n\n${record.content}\n\n重阳节快乐！AI创作诗歌，快来体验吧~ ${window.location.href}`;
              if (navigator.share) {
                navigator.share({
                  title: record.title,
                  text: shareText,
                  url: window.location.href,
                });
              } else if (navigator.clipboard) {
                navigator.clipboard.writeText(shareText);
                alert('诗歌内容已复制到剪贴板！');
              } else {
                alert('请手动复制链接分享给朋友');
              }
            }}
            className="rounded-2xl bg-green-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-green-500"
          >
            📤 分享给朋友
          </button>
        </section>
      </main>
    </div>
  );
}