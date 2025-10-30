import { NextResponse } from "next/server";
import { z } from "zod";

import { generateDoubaoSeedreamImage } from "@/lib/doubao_seedream";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const imageRequestSchema = z.object({
  recordId: z.number(),
  keywords: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
});

// 构建重阳节诗歌配图的专用Prompt
function buildPoemImagePrompt(keywords: string, title?: string, content?: string): string {
  const basePrompt = "中国风古典画，重阳节主题，诗情画意，细腻笔触，高品质";
  const chongyangElements = "金黄菊花，秋天山峰，古典建筑，茱萸，温暖色调";
  
  let prompt = `${keywords}，${chongyangElements}，${basePrompt}，水墨画风格，意境深远，艺术感强`;
  
  // 如果有诗词标题，加入到提示词中
  if (title) {
    prompt = `标题：${title}，${prompt}`;
  }
  
  // 如果有诗词内容，提取关键意象加入到提示词中
  if (content) {
    prompt = `内容：${content}，${prompt}`;
  }
  
  return prompt;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = imageRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.issues[0]?.message ?? "请求参数错误" },
        { status: 400 }
      );
    }

    const { recordId, keywords, title, content } = parseResult.data;

    // 检查记录是否存在
    const existingRecord = await prisma.poemRecord.findUnique({
      where: { id: recordId },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { success: false, error: "诗歌记录不存在" },
        { status: 404 }
      );
    }

    // 构建专用于诗歌的图片生成Prompt
    const enhancedPrompt = buildPoemImagePrompt(keywords, title, content);

    // 生成项目前缀
    const projectPrefix = `poem/${existingRecord.phone.replace(/[^0-9]/g, "")}/${recordId}`;

    // 调用即梦API生成图片
    const generationResult = await generateDoubaoSeedreamImage({
      prompt: enhancedPrompt,
      projectId: projectPrefix,
      size: "2K",
      quality: "hd",
    });

    if (!generationResult.success || !generationResult.urls?.length) {
      const errorMessage = generationResult.error ?? "诗歌配图生成失败";

      // 更新记录状态为失败
      await prisma.poemRecord.update({
        where: { id: recordId },
        data: {
          status: "failed",
          responseJson: {
            error: errorMessage,
            step: "image_generation",
          },
        },
      });

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }

    const imageUrl = generationResult.urls[0];

    // 更新记录，添加图片URL
    await prisma.poemRecord.update({
      where: { id: recordId },
      data: {
        imageUrl,
        responseJson: {
          imageGeneration: generationResult.images || undefined,
          prompt: enhancedPrompt,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        recordId,
        imageUrl,
        prompt: enhancedPrompt,
        gallery: generationResult.urls,
        metrics: generationResult.images,
      },
    });
  } catch (error) {
    console.error("Poem image generation API error", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "图片生成异常，请稍后再试",
      },
      { status: 500 }
    );
  }
}