/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from "crypto"
import sharp from 'sharp'
import { z } from "zod"

import { ossImageManager } from "@/lib/oss-image"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const phoneSchema = z
  .string()
  .min(6, "请输入正确的手机号")
  .max(20, "手机号长度过长")
  .regex(/^[0-9+\-()\s]+$/, "手机号只能包含数字、加号、短横和括号")

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

const ACCEPTED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
}

// doubao-seedream API 支持的格式
const DOUBAO_SUPPORTED_FORMATS = ["jpg", "jpeg"]

function makeProjectPrefix(phone: string) {
  const normalized = phone.replace(/[^0-9]/g, "")
  return `photo-restore/${normalized || "guest"}/${randomUUID()}`
}

function getExtensionFromName(name: string) {
  const parts = name.split(".")
  if (parts.length > 1) {
    return parts.pop()!.toLowerCase()
  }
  return "jpg"
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const phoneRaw = formData.get("phone")
    const imageFile = formData.get("image")

    if (typeof phoneRaw !== "string") {
      return NextResponse.json(
        { error: "请输入手机号" },
        { status: 400 }
      )
    }

    const parseResult = phoneSchema.safeParse(phoneRaw.trim())
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message ?? "手机号格式错误" },
        { status: 400 }
      )
    }

    const phone = parseResult.data

    // 检查是否为有效的文件对象 - 在Node.js环境下验证FormData文件
    if (!imageFile) {
      return NextResponse.json(
        { error: "请选择要上传的图片文件" },
        { status: 400 }
      )
    }
    
    // 验证文件对象的属性
    if (typeof imageFile !== 'object' || imageFile === null) {
      return NextResponse.json(
        { error: "上传的文件格式无效" },
        { status: 400 }
      )
    }
    
    // 检查必要的文件属性
    if (!('size' in imageFile) || !('type' in imageFile) || typeof (imageFile as any).arrayBuffer !== 'function') {
      console.error('Invalid file object properties:', {
        hasSize: 'size' in imageFile,
        hasType: 'type' in imageFile,
        hasArrayBuffer: typeof (imageFile as any).arrayBuffer === 'function',
        constructor: imageFile?.constructor?.name
      })
      return NextResponse.json(
        { error: "文件对象缺少必要属性，请重新选择文件" },
        { status: 400 }
      )
    }

    // 添加调试日志来帮助诊断浏览器特定的问题
    const fileDetails = {
      name: imageFile.name || 'unknown',
      type: imageFile.type || 'unknown',
      size: imageFile.size || 0,
      constructor: imageFile.constructor?.name || 'unknown'
    }
    console.log('File details:', fileDetails)

    if (imageFile.size === 0) {
      return NextResponse.json(
        { error: "上传的文件为空" },
        { status: 400 }
      )
    }

    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "图片大小不能超过15MB" },
        { status: 400 }
      )
    }

    const mimeType = imageFile.type || "image/jpeg"
    // Safari兼容：确保文件名存在
    const fileName = String(imageFile.name || (imageFile as any).fileName || "uploaded-image.jpg")
    const extension = ACCEPTED_MIME_TYPES[mimeType] ?? getExtensionFromName(fileName)

    if (!ACCEPTED_MIME_TYPES[mimeType] && !["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension)) {
      return NextResponse.json(
        { error: "请上传 JPG、PNG、WebP、HEIC 或 HEIF 格式的图片" },
        { status: 400 }
      )
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "上传的文件无法读取" },
        { status: 400 }
      )
    }

    const projectPrefix = makeProjectPrefix(phone)
    
    // 检查是否需要转换格式为JPEG (doubao-seedream API要求)
    let finalBuffer = buffer
    let finalExtension = extension
    let finalMimeType = mimeType
    
    if (!DOUBAO_SUPPORTED_FORMATS.includes(extension.toLowerCase())) {
      console.log(`🔄 转换图片格式 ${extension} -> jpg (doubao-seedream API 要求)`)
      
      try {
        // 使用sharp转换为JPEG格式，保持高质量
        finalBuffer = Buffer.from(await sharp(buffer)
          .jpeg({ 
            quality: 95,
            progressive: true,
            mozjpeg: true // 启用mozjpeg编码器以获得更好的压缩
          })
          .toBuffer())
        finalExtension = "jpg"
        finalMimeType = "image/jpeg"
        
        console.log(`✅ 图片格式转换成功: ${extension} -> jpg (原始大小: ${buffer.length}, 转换后: ${finalBuffer.length})`)
      } catch (error) {
        console.error("❌ 图片格式转换失败:", error)
        return NextResponse.json(
          { error: "图片格式转换失败，请尝试重新上传或使用JPG格式的图片" },
          { status: 400 }
        )
      }
    }

    const originalKey = `${projectPrefix}/original.${finalExtension}`

    await ossImageManager.getOSSClient().put(originalKey, finalBuffer, {
      headers: {
        "Content-Type": finalMimeType,
        "Cache-Control": "public, max-age=31536000",
      },
    })

    const originalUrl = ossImageManager.generateSignedImageUrl(originalKey, 30)

    return NextResponse.json({
      url: originalUrl,
      key: originalKey,
      projectPrefix,
      originalSize: buffer.length,
      finalSize: finalBuffer.length,
      format: finalExtension
    })
  } catch (error) {
    console.error('上传失败:', error)
    return NextResponse.json(
      { error: '上传失败，请重试' },
      { status: 500 }
    )
  }
}