import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const resolvedParams = await params;
    const recordId = parseInt(resolvedParams.recordId, 10);
    
    if (isNaN(recordId)) {
      return NextResponse.json(
        { success: false, error: "无效的记录ID" },
        { status: 400 }
      );
    }

    const record = await prisma.photoRestoreRecord.findUnique({
      where: { 
        id: recordId,
        status: "success" // 只允许查看成功的记录
      },
      select: {
        id: true,
        originalUrl: true,
        restoredUrl: true,
        status: true,
        createdAt: true,
      },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: "记录不存在或未完成" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      { success: false, error: "服务异常，请稍后再试" },
      { status: 500 }
    );
  }
}