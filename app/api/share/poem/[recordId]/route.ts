import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { recordId: string } }
) {
  try {
    const recordId = parseInt(params.recordId);

    if (isNaN(recordId)) {
      return NextResponse.json(
        { success: false, error: "无效的记录ID" },
        { status: 400 }
      );
    }

    // 查询诗歌记录
    const record = await prisma.poemRecord.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        title: true,
        content: true,
        imageUrl: true,
        phone: true,
        createdAt: true,
        status: true,
      },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: "诗歌记录不存在" },
        { status: 404 }
      );
    }

    if (record.status !== "success") {
      return NextResponse.json(
        { success: false, error: "诗歌还未生成完成" },
        { status: 400 }
      );
    }

    // 脱敏手机号
    const maskedPhone = record.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");

    return NextResponse.json({
      success: true,
      data: {
        id: record.id,
        title: record.title,
        content: record.content,
        imageUrl: record.imageUrl,
        phone: maskedPhone,
        createdAt: record.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Poem share API error", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取分享信息异常",
      },
      { status: 500 }
    );
  }
}