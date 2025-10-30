"use client";
/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

type RequestStage = "idle" | "uploading" | "processing" | "done" | "error";

type RestoreResult = {
  originalUrl: string;
  restoredUrl: string;
  gallery: string[];
  recordId?: number;
};

type HistoryRecord = {
  id: number;
  originalUrl: string;
  restoredUrl: string;
  createdAt: string;
};



export default function Home() {
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<RequestStage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);


  const handleQueryHistory = async () => {
    if (!phone.trim()) {
      setMessage("请先输入手机号");
      setStage("error");
      return;
    }

    setLoadingHistory(true);
    try {
      const response = await fetch("/api/history", {
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
      setMessage(data.data.records.length > 0 ? `找到 ${data.data.records.length} 条修图记录` : "暂无修图记录");
      setStage(data.data.records.length > 0 ? "done" : "error");
    } catch {
      setMessage("查询失败，请稍后再试");
      setStage("error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      const input = event.target;
      const selectedFile = input.files?.[0];
      if (!selectedFile) {
        setMessage("未选择文件");
        return;
      }
  
      // 检查文件类型
      const validExt = /\.(png|jpg|jpeg|gif|bmp|tiff|webp|heic|heif|avif)$/i;
      if (!selectedFile.type.startsWith("image/") && !validExt.test(selectedFile.name)) {
        setMessage("请选择有效的图片文件");
        return;
      }
  
      let finalFile: File | Blob = selectedFile;
  
      // Safari兼容：HEIC/HEIF转换
      if (/\.(heic|heif)$/i.test(selectedFile.name)) {
        try {
          setMessage("正在转换HEIC格式...");
          const heic2any = (await import("heic2any")).default;
          
          // 确保blob格式正确
          const convertOptions = {
            blob: selectedFile,
            toType: "image/jpeg" as const,
            quality: 0.95,
          };
          
          const blob = await heic2any(convertOptions);
          const converted = Array.isArray(blob) ? blob[0] : blob;
          
          // Safari兼容的File对象创建
          const newFileName = selectedFile.name.replace(/\.(heic|heif)$/i, ".jpg");
          
          if (typeof File !== "undefined") {
            try {
              finalFile = new File([converted], newFileName, {
                type: "image/jpeg",
              });
            } catch {
              // Safari fallback: 创建类File对象
              finalFile = new Blob([converted], { type: "image/jpeg" });
              Object.defineProperty(finalFile, 'name', {
                value: newFileName,
                writable: false
              });
            }
          } else {
            // 如果File构造函数不存在
            finalFile = new Blob([converted], { type: "image/jpeg" });
            Object.defineProperty(finalFile, 'name', {
              value: newFileName,
              writable: false
            });
          }
          
          setMessage("HEIC格式已转换完成");
        } catch (err) {
          console.error("HEIC 转换失败:", err);
          setMessage(`HEIC转换失败: ${err instanceof Error ? err.message : '未知错误'}，请尝试上传JPG或PNG`);
          return;
        }
      }
  
      // 生成预览URL（Safari中安全）
      try {
        const url = URL.createObjectURL(finalFile);
        setPreviewUrl(url);
        setFile(finalFile as File);
      } catch (err) {
        console.error("创建预览URL失败:", err);
        setMessage("预览生成失败，但文件已选择");
        setFile(finalFile as File);
      }
    } finally {
      // Safari中不允许直接清空input.value
      if (event.target && typeof event.target.blur === "function") {
        event.target.blur();
      }
    }
  };
  

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setMessage("请先选择需要修复的照片");
      setStage("error");
      return;
    }

    if (!phone.trim()) {
      setMessage("请填写手机号，方便我们生成修复记录");
      setStage("error");
      return;
    }

    setStage("uploading");
    setIsSubmitting(true);
    setMessage(null);
    setResult(null);

    try {
      // 第一步：上传文件
      const uploadFormData = new FormData();
      uploadFormData.append("phone", phone.trim());
      uploadFormData.append("image", file);

      const uploadResponse = await fetch("/api/upload", {
        method: 'POST',
        body: uploadFormData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || '图片上传失败');
      }

      setStage("processing");

      // 第二步：调用修复API
      const restoreResponse = await fetch("/api/photo-restore", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phone.trim(),
          imageUrl: uploadData.url,
        }),
      });

      const payload = await restoreResponse.json();

      if (!restoreResponse.ok || !payload.success) {
        throw new Error(payload.error || "修复失败，请稍后再试");
      }

      setResult({
        originalUrl: payload.data.originalUrl,
        restoredUrl: payload.data.restoredUrl,
        gallery: payload.data.gallery ?? [],
        recordId: payload.data.recordId,
      });

      setStage("done");
      setMessage("修复完成！快来看看焕新后的模样吧");
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "修复失败，请稍后再试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5efdc] text-slate-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl shadow-2xl">
          <Image
            src="/banner.jpg"
            alt="重阳节 AI 照片焕新活动"
            width={1200}
            height={675}
            className="h-[220px] w-full object-cover sm:h-[320px] md:h-[360px]"
            priority
          />

        </section>

        <section className="relative rounded-3xl bg-white/95 p-6 text-slate-900 shadow-xl backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                上传老照片 · AI 焕新记忆
              </h2>
              
            </div>

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
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm outline-none ring-indigo-400 transition focus:border-indigo-400 focus:ring-2"
                  autoComplete="tel"
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">上传需要修复的老照片</label>
                <label
                  htmlFor="image"
                  className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                    previewUrl
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="上传照片预览"
                      className="h-48 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <>
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-indigo-500 shadow-md">
                        ⬆️
                      </span>
                      <p className="text-base font-semibold text-slate-700">
                        点击或拖入照片
                      </p>
                      <p className="text-xs text-slate-500">支持 JPG / PNG / WEBP / HEIC，大小不超过 15MB</p>
                    </>
                  )}
                  <input
                    id="image"
                    type="file"
                    accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onClick={(e) => {
                      // Safari fix: 允许重复选择同一文件
                      (e.target as HTMLInputElement).value = "";
                    }}
                    onChange={handleFileChange}
                  />
                </label>
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
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "AI 正在修复中..." : "立即修复老照片"}
                </button>
                
                <button
                  type="button"
                  onClick={handleQueryHistory}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-600 px-4 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={loadingHistory}
                >
                  {loadingHistory ? "查询中..." : "查看我的修图记录"}
                </button>
              </div>
            </form>
          </div>
        </section>

        {result && (
          <section className="relative rounded-3xl bg-white/95 p-6 text-slate-900 shadow-xl backdrop-blur sm:p-8">
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">修复效果对比</h2>
                <p className="mt-2 text-sm text-slate-500 sm:text-base">
                  记录编号：{result.recordId ?? "--"} · 可以长按保存或直接下载
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <figure className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="rounded-xl bg-slate-100 p-2">
                    <img src={result.originalUrl} alt="原始老照片" className="h-64 w-full rounded-lg object-cover" />
                  </div>
                  <figcaption className="text-center text-sm font-medium text-slate-600">原始照片</figcaption>
                </figure>
                <figure className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="rounded-xl bg-slate-100 p-2">
                    <img src={result.restoredUrl} alt="修复后照片" className="h-64 w-full rounded-lg object-cover" />
                  </div>
                  <figcaption className="text-center text-sm font-medium text-slate-600">修复后照片</figcaption>
                </figure>
              </div>

              {result.gallery.length > 1 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-800">更多修复版本</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {result.gallery.map((url, index) => (
                      <img
                        key={url + index}
                        src={url}
                        alt={`修复版本 ${index + 1}`}
                        className="h-32 w-full rounded-xl object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href={result.restoredUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500"
                >
                  下载修复照片
                </a>
                <a
                  href={result.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800"
                >
                  查看原图
                </a>
              </div>

              {/* 分享朋友圈CTA */}
              <div className="mt-6 rounded-2xl bg-gradient-to-r from-yellow-50 to-orange-50 p-4 border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📸</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">分享焕新成果</p>
                      <p className="text-xs text-slate-600">让亲朋好友也来体验AI修复</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const shareUrl = `${window.location.origin}/share/${result.recordId}`;
                      try {
                        if (!navigator.clipboard) {
                          throw new Error("clipboard API not available");
                        }
                        await navigator.clipboard.writeText(shareUrl);
                        alert('分享链接已复制到剪贴板！');
                      } catch (error) {
                        console.error('复制链接失败:', error);
                        alert('复制失败，请手动复制链接');
                      }
                    }}
                    className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600"
                  >
                    <span>📤</span>
                    分享朋友圈
                  </button>
                </div>
              </div>

              {/* 再次生成引导 */}
              <div className="mt-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✨</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">还有其他老照片？</p>
                      <p className="text-xs text-slate-600">继续修复更多珍贵回忆</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setResult(null);
                      setStage("idle");
                      setFile(null);
                      setPreviewUrl(null);
                      setMessage(null);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-600"
                  >
                    <span>➕</span>
                    再修复一张
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 历史记录展示 */}
        {showHistory && historyRecords.length > 0 && (
          <section className="relative rounded-3xl bg-white/95 p-6 text-slate-900 shadow-xl backdrop-blur sm:p-8">
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">我的修图记录</h2>
                <p className="mt-2 text-sm text-slate-500">
                  手机号：{phone} · 共 {historyRecords.length} 条记录
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {historyRecords.map((record) => (
                  <div key={record.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="rounded-lg bg-slate-100 p-2">
                        <img src={record.originalUrl} alt="原始照片" className="h-24 w-full rounded object-cover" />
                        <p className="text-xs text-center text-slate-600 mt-1">原始</p>
                      </div>
                      <div className="rounded-lg bg-slate-100 p-2">
                        <img src={record.restoredUrl} alt="修复后" className="h-24 w-full rounded object-cover" />
                        <p className="text-xs text-center text-slate-600 mt-1">修复后</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-2">
                        {new Date(record.createdAt).toLocaleDateString()} · ID: {record.id}
                      </p>
                      <div className="flex gap-2">
                        <a
                          href={record.restoredUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
                        >
                          下载
                        </a>
                        <button
                          onClick={async () => {
                            const shareUrl = `${window.location.origin}/share/${record.id}`;
                            try {
                              if (!navigator.clipboard) {
                                throw new Error("clipboard API not available");
                              }
                              await navigator.clipboard.writeText(shareUrl);
                              alert('分享链接已复制！');
                            } catch (error) {
                              console.error('复制链接失败:', error);
                              alert('复制失败，请手动复制链接');
                            }
                          }}
                          className="flex-1 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
                        >
                          分享
                        </button>
                      </div>
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
