"use client";

import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f5efdc] text-slate-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl shadow-2xl">
          <Image
            src="/banner.jpg"
            alt="重阳节 AI 活动"
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
                重阳节 AI 体验
              </h2>
              <p className="mt-2 text-sm text-slate-500 sm:text-base">
                选择您想要的AI服务
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* AI照片修复 */}
              <Link
                href="/photo"
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 border border-amber-200 p-6 text-amber-900 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 rounded-full bg-amber-200/50 p-4">
                    <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold">AI 照片焕新</h3>
                  <p className="mt-2 text-sm opacity-80">
                    上传老照片，AI智能修复<br />
                    让珍贵回忆重现光彩
                  </p>
                  <div className="mt-4 rounded-lg bg-amber-200/30 px-3 py-1 text-xs">
                    点击体验 →
                  </div>
                </div>
              </Link>

              {/* AI诗歌创作 */}
              <Link
                href="/poem"
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-50 to-amber-50 border border-stone-200 p-6 text-stone-800 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 rounded-full bg-stone-200/50 p-4">
                    <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold">AI 诗歌创作</h3>
                  <p className="mt-2 text-sm opacity-80">
                    定制重阳节诗歌<br />
                    配上诗情画意的AI插图
                  </p>
                  <div className="mt-4 rounded-lg bg-stone-200/30 px-3 py-1 text-xs">
                    点击体验 →
                  </div>
                </div>
              </Link>
            </div>

            {/* 节日介绍 */}
            <div className="mt-6 rounded-2xl bg-gradient-to-r from-yellow-50 to-orange-50 p-4 border border-yellow-200">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">九九重阳节</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  重阳节，又称登高节、菊花节，是中华民族的传统节日。<br />
                  在这个特殊的日子里，让AI帮您创作诗歌、修复老照片，<br />
                  用科技传承文化，用温情连接亲情。
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}