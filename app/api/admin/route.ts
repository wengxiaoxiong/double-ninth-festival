import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 获取所有照片修复记录
    const photoRecords = await prisma.photoRestoreRecord.findMany({
      select: {
        id: true,
        phone: true,
        originalUrl: true,
        restoredUrl: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // 最多返回50条记录
    });

    // 获取所有诗歌记录
    const poemRecords = await prisma.poemRecord.findMany({
      select: {
        id: true,
        phone: true,
        title: true,
        content: true,
        imageUrl: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // 最多返回50条记录
    });

    // 统计信息
    const stats = {
      totalPhotoRecords: await prisma.photoRestoreRecord.count(),
      successfulPhotoRecords: await prisma.photoRestoreRecord.count({
        where: { status: "success" }
      }),
      totalPoemRecords: await prisma.poemRecord.count(),
      successfulPoemRecords: await prisma.poemRecord.count({
        where: { status: "success" }
      }),
    };

    return NextResponse.json({
      success: true,
      data: {
        photoRecords: photoRecords.map(record => ({
          ...record,
          createdAt: record.createdAt.toISOString(),
        })),
        poemRecords: poemRecords.map(record => ({
          ...record,
          createdAt: record.createdAt.toISOString(),
        })),
        stats,
      },
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return NextResponse.json(
      { success: false, error: "服务异常，请稍后再试" },
      { status: 500 }
    );
  }
}