import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import sharp from "sharp";

import { generateDoubaoSeedreamImage } from "@/lib/doubao_seedream";
import { ossImageManager } from "@/lib/oss-image";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const phoneSchema = z
  .string()
  .min(6, "请输入正确的手机号")
  .max(20, "手机号长度过长")
  .regex(/^[0-9+\-()\s]+$/, "手机号只能包含数字、加号、短横和括号");

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

const ACCEPTED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

// doubao-seedream API 支持的格式
const DOUBAO_SUPPORTED_FORMATS = ["jpg", "jpeg", "png"];

const fallbackPrompt =
  "请对输入的老照片进行修复，保持人物外观真实自然，修正刮痕、噪点和模糊，还原为彩色光影，并且变成清晰的图像，犹如索尼相机拍摄，高色彩饱和度。";

function makeProjectPrefix(phone: string) {
  const normalized = phone.replace(/[^0-9]/g, "");
  return `photo-restore/${normalized || "guest"}/${randomUUID()}`;
}

function getExtensionFromName(name: string) {
  const parts = name.split(".");
  if (parts.length > 1) {
    return parts.pop()!.toLowerCase();
  }
  return "jpg";
}

export async function POST(request: Request) {
  let recordId: number | null = null;
  let originalUrl: string | null = null;

  try {
    const body = await request.json();
    const { phone: phoneRaw, imageUrl } = body;

    if (typeof phoneRaw !== "string") {
      return NextResponse.json(
        { success: false, error: "请输入手机号" },
        { status: 400 }
      );
    }

    const parseResult = phoneSchema.safeParse(phoneRaw.trim());
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.issues[0]?.message ?? "手机号格式错误" },
        { status: 400 }
      );
    }

    const phone = parseResult.data;

    if (typeof imageUrl !== "string" || !imageUrl.trim()) {
      return NextResponse.json(
        { success: false, error: "请提供有效的图片URL" },
        { status: 400 }
      );
    }

    originalUrl = imageUrl.trim();

    const projectPrefix = makeProjectPrefix(phone);

    const createdRecord = await prisma.photoRestoreRecord.create({
      data: {
        phone,
        originalUrl,
        status: "processing",
      },
    });

    recordId = createdRecord.id;

    const generationResult = await generateDoubaoSeedreamImage({
      prompt: fallbackPrompt,
      image: originalUrl,
      projectId: projectPrefix,
      size: "2K",
      quality: "hd",
    });

    if (!generationResult.success || !generationResult.urls?.length) {
      const errorMessage = generationResult.error ?? "老照片修复失败";

      if (recordId) {
        await prisma.photoRestoreRecord.update({
          where: { id: recordId },
          data: {
            status: "failed",
            responseJson: {
              error: errorMessage,
            },
          },
        });
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }

    const restoredUrl = generationResult.urls[0];

    await prisma.photoRestoreRecord.update({
      where: { id: recordId },
      data: {
        status: "success",
        restoredUrl,
        responseJson: generationResult.images || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        recordId,
        phone,
        originalUrl,
        restoredUrl,
        gallery: generationResult.urls,
        metrics: generationResult.images,
      },
    });
  } catch (error) {
    console.error("Photo restore API error", error);

    if (recordId && originalUrl) {
      await prisma.photoRestoreRecord.update({
        where: { id: recordId },
        data: {
          status: "failed",
          responseJson: {
            error: error instanceof Error ? error.message : "未知错误",
          },
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "服务异常，请稍后再试",
      },
      { status: 500 }
    );
  }
}
