import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const phoneSchema = z
  .string()
  .min(6, "请输入正确的手机号")
  .max(20, "手机号长度过长")
  .regex(/^[0-9+\-()\s]+$/, "手机号只能包含数字、加号、短横和括号");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (typeof phone !== "string") {
      return NextResponse.json(
        { success: false, error: "请输入手机号" },
        { status: 400 }
      );
    }

    const parseResult = phoneSchema.safeParse(phone.trim());
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.issues[0]?.message ?? "手机号格式错误" },
        { status: 400 }
      );
    }

    const validPhone = parseResult.data;

    // 查询该手机号的修图记录
    const records = await prisma.photoRestoreRecord.findMany({
      where: {
        phone: validPhone,
        status: "success", // 只返回成功的记录
      },
      select: {
        id: true,
        originalUrl: true,
        restoredUrl: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10, // 最多返回10条记录
    });

    return NextResponse.json({
      success: true,
      data: {
        phone: validPhone,
        records,
        total: records.length,
      },
    });
  } catch (error) {
    console.error("History API error:", error);
    return NextResponse.json(
      { success: false, error: "服务异常，请稍后再试" },
      { status: 500 }
    );
  }
}