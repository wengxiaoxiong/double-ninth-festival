import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const phoneSchema = z
  .string()
  .min(6, "请输入正确的手机号")
  .max(20, "手机号长度过长")
  .regex(/^[0-9+\-()\s]+$/, "手机号只能包含数字、加号、短横和括号");

const poemRequestSchema = z.object({
  phone: phoneSchema,
  elements: z.array(z.string()).optional(),
  customText: z.string().optional(),
});

// DeepSeek API配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

// 诗歌模板和关键词映射
const POEM_TEMPLATES = [
  {
    elements: ["菊花", "登高", "秋风"],
    title: "重阳登高",
    template: "九九登高望远山，秋风萧瑟叶飘然。手持茱萸思故里，遥寄亲情到云边。",
    keywords: "秋天山峰，金黄菊花，古典山水画，中国风，暖色调，重阳节氛围"
  },
  {
    elements: ["菊花", "敬老", "团圆"],
    title: "菊花香",
    template: "金菊绽放满庭芳，重阳佳节倍思乡。举杯遥祝亲人健，但愿长安共此光。",
    keywords: "盛开的金色菊花，中式庭院，秋天，温馨氛围，中国画风格"
  },
  {
    elements: ["敬老", "亲情", "团圆"],
    title: "敬老情深",
    template: "重阳佳节寄深情，敬老尊贤代代承。团圆时刻心相聚，天伦之乐暖人心。",
    keywords: "温馨家庭聚会，祖孙三代，菊花茶，传统中式客厅，温暖色调"
  },
  {
    elements: ["思乡", "明月", "茱萸"],
    title: "秋思",
    template: "明月高悬照九州，秋风送爽上高楼。遍插茱萸少一人，他乡游子泪双流。",
    keywords: "明月，古典高楼，秋天夜晚，茱萸，思乡意境，中国水墨画风格"
  }
];

async function generatePoemWithDeepSeek(elements: string[], customText?: string): Promise<{ title: string; content: string; keywords: string }> {
  if (!DEEPSEEK_API_KEY) {
    console.warn("DeepSeek API key not found, using template");
    return selectPoemTemplate(elements);
  }

  try {
    const elementsText = elements.length > 0 ? elements.join("、") : "重阳节";
    const customPrompt = customText ? `，结合以下内容：${customText}` : "";
    
    const prompt = `请创作一首关于重阳节的古典诗歌，要求：
1. 包含这些元素：${elementsText}${customPrompt}
2. 四句七言绝句格式
3. 符合重阳节的文化内涵和情感氛围
4. 语言优美，意境深远

请返回JSON格式：
{
  "title": "诗歌标题",
  "content": "诗歌内容（四句话，用换行符分隔）",
  "keywords": "适合的详细图像描述。需要保留原本用户想表达的细节"
}`;

    console.log("🚀 开始调用 DeepSeek API:", prompt);


    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from DeepSeek");
    }

    // 尝试解析JSON
    try {
      const parsedContent = JSON.parse(content);
      return {
        title: parsedContent.title || "重阳抒怀",
        content: parsedContent.content || content,
        keywords: parsedContent.keywords || "重阳节，中国风，古典，诗情画意",
      };
    } catch {
      // 如果不是JSON格式，使用文本内容
      return {
        title: "重阳抒怀",
        content: content,
        keywords: `重阳节，${elementsText}，中国风，古典山水画，诗情画意`,
      };
    }
  } catch (error) {
    console.error("DeepSeek API error:", error);
    return selectPoemTemplate(elements);
  }
}

function selectPoemTemplate(elements: string[]): { title: string; content: string; keywords: string } {
  // 根据选择的元素找到最匹配的模板
  let bestMatch = POEM_TEMPLATES[0];
  let maxMatches = 0;

  for (const template of POEM_TEMPLATES) {
    const matches = template.elements.filter(el => elements.includes(el)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = template;
    }
  }

  // 如果没有匹配的元素，随机选择一个模板
  if (maxMatches === 0) {
    bestMatch = POEM_TEMPLATES[Math.floor(Math.random() * POEM_TEMPLATES.length)];
  }

  return {
    title: bestMatch.title,
    content: bestMatch.template,
    keywords: bestMatch.keywords,
  };
}

export async function POST(request: Request) {
  let recordId: number | null = null;

  try {
    const body = await request.json();
    const parseResult = poemRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.issues[0]?.message ?? "请求参数错误" },
        { status: 400 }
      );
    }

    const { phone, elements = [], customText } = parseResult.data;

    // 生成诗歌
    const poemResult = await generatePoemWithDeepSeek(elements, customText);

    // 保存到数据库
    const createdRecord = await prisma.poemRecord.create({
      data: {
        phone,
        title: poemResult.title,
        content: poemResult.content,
        elements: elements.join(","),
        customText: customText || null,
        imageKeywords: poemResult.keywords,
        status: "success",
        requestId: randomUUID(),
      },
    });

    recordId = createdRecord.id;

    return NextResponse.json({
      success: true,
      data: {
        recordId,
        phone,
        title: poemResult.title,
        content: poemResult.content,
        imageKeywords: poemResult.keywords,
        elements,
        customText,
      },
    });
  } catch (error) {
    console.error("Poem generation API error", error);

    if (recordId) {
      await prisma.poemRecord.update({
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
        error: error instanceof Error ? error.message : "诗歌生成异常，请稍后再试",
      },
      { status: 500 }
    );
  }
}