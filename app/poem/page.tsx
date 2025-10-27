"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { FormEvent } from "react";

type RequestStage = "idle" | "generating_poem" | "generating_image" | "done" | "error";

type PoemResult = {
  title: string;
  content: string;
  imageUrl?: string;
  imageKeywords?: string;
  recordId?: number;
};

type HistoryRecord = {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
};

const CHONGYANG_ELEMENTS = [
  { value: "菊花", emoji: "🌼" },
  { value: "登高", emoji: "⛰️" },
  { value: "茱萸", emoji: "🌿" },
  { value: "重阳糕", emoji: "🍰" },
  { value: "敬老", emoji: "👴" },
  { value: "思乡", emoji: "🏠" },
  { value: "团圆", emoji: "❤️" },
  { value: "秋风", emoji: "🍃" },
  { value: "明月", emoji: "🌕" },
  { value: "亲情", emoji: "👨‍👩‍👧‍👦" },
];

export default function PoemPage() {
  const [phone, setPhone] = useState("");
  const [customText, setCustomText] = useState("");
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [stage, setStage] = useState<RequestStage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PoemResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  const handleElementToggle = (element: string) => {
    setSelectedElements(prev => 
      prev.includes(element) 
        ? prev.filter(el => el !== element)
        : [...prev, element]
    );
  };

  const handleQueryHistory = async () => {
    if (!phone.trim()) {
      setMessage("请先输入手机号");
      setStage("error");
      return;
    }

    setLoadingHistory(true);
    try {
      const response = await fetch("/api/poem-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.error || "查询失败");
        setStage("error");
        return;
      }

      setHistoryRecords(data.data.records);
      setShowHistory(true);
      setMessage(data.data.records.length > 0 ? "找到 " + data.data.records.length + " 条诗歌记录" : "暂无诗歌记录");
      setStage(data.data.records.length > 0 ? "done" : "error");
    } catch (error) {
      setMessage("查询失败，请稍后再试");
      setStage("error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const simulateLoadingText = (texts: string[], callback: () => void) => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < texts.length) {
        setLoadingText(texts[index]);
        index++;
      } else {
        clearInterval(interval);
        callback();
      }
    }, 800);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!phone.trim()) {
      setMessage("请填写手机号，方便我们保存您的诗歌记录");
      setStage("error");
      return;
    }

    if (selectedElements.length === 0 && !customText.trim()) {
      setMessage("请至少选择一个重阳元素或输入自定义内容");
      setStage("error");
      return;
    }

    setStage("generating_poem");
    setIsSubmitting(true);
    setMessage(null);
    setResult(null);
    setShowHistory(false);

    // 模拟诗歌生成过程
    const poemLoadingTexts = [
      "正在分析创作元素...",
      "正在构思诗歌意境...",
      "正在雕琢诗句韵律...",
      "正在添加重阳情怀...",
      "诗歌创作完成！"
    ];

    simulateLoadingText(poemLoadingTexts, async () => {
      try {
        const response = await fetch("/api/poem-generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: phone.trim(),
            elements: selectedElements,
            customText: customText.trim(),
          }),
        });

        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "诗歌生成失败，请稍后再试");
        }

        setResult({
          title: payload.data.title,
          content: payload.data.content,
          imageKeywords: payload.data.imageKeywords,
          recordId: payload.data.recordId,
        });

        setStage("generating_image");

        // 生成AI图片
        const imageLoadingTexts = [
          "正在分析诗歌意境...",
          "正在构建视觉元素...",
          "正在绘制AI图片...",
          "正在优化画面效果...",
          "图片生成完成！"
        ];

        simulateLoadingText(imageLoadingTexts, async () => {
          try {
            const imageResponse = await fetch("/api/poem-image", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                recordId: payload.data.recordId,
                keywords: payload.data.imageKeywords,
              }),
            });

            const imagePayload = await imageResponse.json();

            if (imageResponse.ok && imagePayload.success) {
              setResult(prev => prev ? {
                ...prev,
                imageUrl: imagePayload.data.imageUrl,
              } : null);
            }

            setStage("done");
            setMessage("诗歌和配图生成完成！");
          } catch (error) {
            setStage("done");
            setMessage("诗歌生成完成，但配图生成失败");
          }
        });

      } catch (error) {
        setStage("error");
        setMessage(error instanceof Error ? error.message : "诗歌生成失败，请稍后再试");
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleReset = () => {
    setStage("idle");
    setResult(null);
    setMessage(null);
    setShowHistory(false);
    setSelectedElements([]);
    setCustomText("");
  };

  const getStageDisplay = () => {
    switch (stage) {
      case "generating_poem":
        return (
          <div className="text-center py-8">
            <div className="inline-block w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
            <p className="text-orange-600 font-medium">{loadingText}</p>
          </div>
        );
      case "generating_image":
        return (
          <div className="text-center py-8">
            <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-blue-600 font-medium">{loadingText}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f5efdc] text-slate-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        {/* Banner */}
        <section className="relative overflow-hidden rounded-3xl shadow-2xl">
          <Image
            src="/banner_poem.jpg"
            alt="重阳节 AI 诗歌创作"
            width={1058}
            height={400}
            className="h-[200px] w-full object-cover sm:h-[280px] md:h-[320px]"
            priority
          />
        </section>

        {/* 返回首页 */}
        <div className="flex justify-between items-center">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            ← 返回首页
          </Link>
          <h1 className="text-xl font-semibold text-slate-800">AI 诗歌创作</h1>
        </div>

        {/* 主要内容 */}
        <section className="relative rounded-3xl bg-white/95 p-6 text-slate-900 shadow-xl backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                重阳节 AI 诗歌创作
              </h2>
              <p className="mt-2 text-sm text-slate-500 sm:text-base">
                输入创作元素，AI为您创作专属重阳诗歌
              </p>
            </div>

            {/* 步骤显示 */}
            {getStageDisplay()}

            {/* 表单 */}
            {(stage === "idle" || stage === "error") && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                    联系手机号
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="请输入手机号"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm outline-none ring-orange-400 transition focus:border-orange-400 focus:ring-2"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    选择重阳元素（可多选）
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CHONGYANG_ELEMENTS.map((element) => (
                      <button
                        key={element.value}
                        type="button"
                        onClick={() => handleElementToggle(element.value)}
                        className={`flex items-center gap-1 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                          selectedElements.includes(element.value)
                            ? "bg-orange-500 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <span>{element.emoji}</span>
                        {element.value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="customText" className="block text-sm font-medium text-slate-700">
                    自定义内容（可选）
                  </label>
                  <textarea
                    id="customText"
                    name="customText"
                    placeholder="在这里输入您想表达的内容，比如对家人的思念、对长辈的祝福..."
                    value={customText}
                    onChange={(event) => setCustomText(event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm outline-none ring-orange-400 transition focus:border-orange-400 focus:ring-2 resize-none"
                  />
                </div>

                {message && (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      stage === "error" ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {message}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "AI 正在创作中..." : "✨ AI 创作诗歌"}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleQueryHistory}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-600 px-4 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={loadingHistory}
                  >
                    {loadingHistory ? "查询中..." : "📖 查看我的诗歌记录"}
                  </button>
                </div>
              </form>
            )}

            {/* 结果展示 */}
            {result && stage === "done" && (
              <div className="space-y-6">
                <div className="rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 p-6 border border-yellow-200">
                  <h3 className="text-xl font-bold text-slate-800 text-center mb-4">{result.title}</h3>
                  <div className="text-slate-700 text-center leading-relaxed whitespace-pre-line font-serif text-lg">
                    {result.content}
                  </div>
                </div>

                {result.imageUrl && (
                  <div className="">
                    <img
                      src={result.imageUrl}
                      alt="AI生成的诗歌配图"
                      className="w-full object-contain"
                      style={{ maxHeight: '500px' }}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/share/poem/${result.recordId}`;
                      navigator.clipboard.writeText(shareUrl);
                      alert('分享链接已复制到剪贴板！');
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-green-500"
                  >
                    📤 分享诗歌
                  </button>
                  
                  <button
                    onClick={handleReset}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-200 px-4 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-300"
                  >
                    ➕ 创作新诗歌
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 历史记录展示 */}
        {showHistory && historyRecords.length > 0 && (
          <section className="relative rounded-3xl bg-white/95 p-6 text-slate-900 shadow-xl backdrop-blur sm:p-8">
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">我的诗歌记录</h2>
                <p className="mt-2 text-sm text-slate-500">
                  手机号：{phone} · 共 {historyRecords.length} 首诗歌
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {historyRecords.map((record) => (
                  <div key={record.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-2">{record.title}</h4>
                    <div className="text-sm text-slate-600 leading-relaxed mb-3 font-serif">
                      {record.content.split('\n').slice(0, 2).join('\n')}
                      {record.content.split('\n').length > 2 && '...'}
                    </div>
                    {record.imageUrl && (
                      <div className="rounded-lg overflow-hidden mb-3">
                      <img
                      src={record.imageUrl}
                      alt="AI生成的诗歌配图"
                      className="w-full object-contain"
                      style={{ maxHeight: '500px' }}
                    />
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => {
                          const shareUrl = `${window.location.origin}/share/poem/${record.id}`;
                          navigator.clipboard.writeText(shareUrl);
                          alert('分享链接已复制！');
                        }}
                        className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-orange-600"
                      >
                        分享
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <button
                  onClick={() => {
                    setShowHistory(false);
                    setHistoryRecords([]);
                    setMessage(null);
                    setStage("idle");
                  }}
                  className="rounded-2xl bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
                >
                  收起记录
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}