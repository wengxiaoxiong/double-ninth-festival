import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const phoneSchema = z
  .string()
  .min(6, "请输入正确的手机号")
  .max(20, "手机号长度过长")
  .regex(/^[0-9+\-()\s]+$/, "手机号只能包含数字、加号、短横和括号");

const historyRequestSchema = z.object({
  phone: phoneSchema,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = historyRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.issues[0]?.message ?? "手机号格式错误" },
        { status: 400 }
      );
    }

    const { phone } = parseResult.data;

    // 查询该手机号的所有诗歌记录
    const records = await prisma.poemRecord.findMany({
      where: {
        phone,
        status: "success", // 只返回成功生成的记录
      },
      select: {
        id: true,
        title: true,
        content: true,
        imageUrl: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc", // 按创建时间倒序排列
      },
      take: 20, // 最多返回20条记录
    });

    return NextResponse.json({
      success: true,
      data: {
        phone,
        records: records.map(record => ({
          id: record.id,
          title: record.title,
          content: record.content,
          imageUrl: record.imageUrl,
          createdAt: record.createdAt.toISOString(),
        })),
        total: records.length,
      },
    });
  } catch (error) {
    console.error("Poem history API error", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "查询历史记录异常，请稍后再试",
      },
      { status: 500 }
    );
  }
}