"use server";

import { z } from "zod";
import { processAndUploadImagesBatch } from "@/lib/image-utils";
import type { ResizeOptions } from "sharp";

// 类型定义
type DoubaoSeedreamSize = "2K" | "4K";

interface DoubaoSeedreamRequest {
  model: "doubao-seedream-4-0-250828";
  prompt: string;
  negative_prompt?: string;
  image?: string | string[]; // 参考图url
  size: DoubaoSeedreamSize;
  num_images?: number;
  sequential_image_generation?: "disabled" | "auto";
  stream: boolean;
  response_format: "url";
  watermark: boolean;
  seed?: number;
  quality?: number | "standard" | "hd";
}

interface DoubaoSeedreamResponse {
  data: Array<{
    url: string;
  }>;
}

// 输入参数验证
const DoubaoSeedreamInputSchema = z.object({
  prompt: z.string().min(1).max(800, "提示词不能超过800字符"),
  negative_prompt: z.string().max(500, "反向提示词不能超过500字符").optional(),
  image: z.union([z.string(), z.array(z.string())]).optional(),
  size: z
    .union([
      z.enum(["2K", "4K"]),
      z
        .string()
        .regex(/^[0-9]+x[0-9]+$/i, "尺寸格式必须为 WxH，例如 1440x2560")
    ])
    .optional()
    .default("2K"),
  num_images: z.number().min(1).max(4).optional().default(1),
  sequential_image_generation: z.enum(["disabled", "auto"]).optional().default("disabled"),
  stream: z.boolean().optional().default(false),
  watermark: z.boolean().optional().default(false),
  seed: z.number().min(0).max(2147483647).optional(),
  quality: z.union([
    z.number().min(1).max(10),
    z.enum(["standard", "hd"])
  ]).optional(),
});

// API 配置
const DOUBAO_SEEDREAM_API_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";

/**
 * 生成图像并上传到 OSS
 * @param params 图像生成参数
 * @returns 返回 OSS 上的图像 URL
 */
export async function generateDoubaoSeedreamImage(params: {
  prompt: string;
  negative_prompt?: string;
  image?: string | string[];
  size?: string;
  num_images?: number;
  sequential_image_generation?: "disabled" | "auto";
  stream?: boolean;
  watermark?: boolean;
  seed?: number;
  projectId?: string;
  quality?: number | "standard" | "hd";
  resizeOptions?: ResizeOptions;
}): Promise<{
  success: boolean;
  urls?: string[];
  ossKeys?: string[];
  error?: string;
  images?: Array<{ url: string; ossKey?: string; originalSize?: number; compressedSize?: number; compressionRatio?: number }>;
}> {
  try {
    // 验证输入参数
    const { resizeOptions, ...schemaInput } = params;
    const validatedParams = DoubaoSeedreamInputSchema.parse(schemaInput);

    const requestedSize = validatedParams.size;
    let apiSize: DoubaoSeedreamSize = "2K";
    let targetResizeOptions: ResizeOptions | undefined = resizeOptions;

    if (typeof requestedSize === "string" && /^[0-9]+x[0-9]+$/i.test(requestedSize)) {
      const [widthStr, heightStr] = requestedSize.toLowerCase().split("x");
      const width = parseInt(widthStr, 10);
      const height = parseInt(heightStr, 10);

      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        const maxDimension = Math.max(width, height);
        apiSize = maxDimension > 2048 ? "4K" : "2K";

        if (!targetResizeOptions) {
          targetResizeOptions = {
            width,
            height,
            fit: "cover",
            position: "center",
          };
        }
      }
    } else if (requestedSize === "4K") {
      apiSize = "4K";
    } else {
      apiSize = "2K";
    }

    // 获取 API Key
    const apiKey = process.env.SEED_EDIT_KEY;
    if (!apiKey) {
      throw new Error("SEED_EDIT_KEY 环境变量未配置");
    }

    // 构建请求体
    const requestBody: DoubaoSeedreamRequest = {
      model: "doubao-seedream-4-0-250828",
      prompt: validatedParams.prompt,
      size: apiSize,
      num_images: 2,
      sequential_image_generation: "auto",
      stream: validatedParams.stream,
      response_format: "url",
      watermark: validatedParams.watermark,
    };

    // 添加可选参数
    if (validatedParams.negative_prompt) {
      requestBody.negative_prompt = validatedParams.negative_prompt;
    }
    if (validatedParams.image) {
      requestBody.image = validatedParams.image;
    }
    if (validatedParams.seed !== undefined) {
      requestBody.seed = validatedParams.seed;
    }
    if (validatedParams.quality !== undefined) {
      requestBody.quality = validatedParams.quality;
    }

    console.log("🚀 开始调用 doubao-seedream API:", {
      prompt: validatedParams.prompt,
      requestedSize,
      apiSize: requestBody.size,
      num_images: requestBody.num_images,
      seed: requestBody.seed,
      quality: requestBody.quality,
      hasImage: !!requestBody.image,
      imageUrl: requestBody.image,
      hasNegativePrompt: !!requestBody.negative_prompt
    });
    
    console.log("📤 请求体详情:", JSON.stringify(requestBody, null, 2));

    // 调用 doubao-seedream API
    const response = await fetch(DOUBAO_SEEDREAM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ doubao-seedream API 调用失败:", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText
      });
      
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(`API 调用失败: ${errorData.error?.message || errorText} (${errorData.error?.code || response.status})`);
      } catch {
        throw new Error(`API 调用失败: ${response.status} ${response.statusText} - ${errorText}`);
      }
    }

    const result: DoubaoSeedreamResponse = await response.json();
    console.log("✅ doubao-seedream API 调用成功:");
    console.log("📊 API原始响应:", JSON.stringify(result, null, 2));

    // 获取所有图像 URLs
    const imageUrls = result.data?.map(item => item.url) || [];
    if (imageUrls.length === 0) {
      throw new Error("API 响应中未找到图像 URL");
    }

    console.log("✅ 图像生成完成，开始处理:", {
      image_count: imageUrls.length,
      image_urls: imageUrls
    });

    // 处理quality参数，将字符串转换为数字
    let imageQuality = 80; // 默认质量
    if (params.quality) {
      if (typeof params.quality === 'number') {
        imageQuality = params.quality * 10; // 1-10 转换为 10-100
      } else if (params.quality === 'standard') {
        imageQuality = 80;
      } else if (params.quality === 'hd') {
        imageQuality = 95;
      }
    }

    // 如果请求的图片数量大于实际返回的数量，进行多次调用
    const requestedImages = validatedParams.num_images || 1;
    const allImageUrls = [...imageUrls];
    
    // 如果豆包API只返回了1张图片但请求了多张，需要多次调用
    if (imageUrls.length < requestedImages) {
      console.log(`📸 需要生成 ${requestedImages} 张图片，但API只返回了 ${imageUrls.length} 张，进行额外调用...`);
      
      const remainingImages = requestedImages - imageUrls.length;
      for (let i = 0; i < remainingImages; i++) {
        try {
          console.log(`🔄 进行第 ${i + 2} 次API调用...`);
          
          // 重新调用API（去掉num_images参数，因为豆包可能不支持）
          const additionalRequestBody = { ...requestBody };
          delete additionalRequestBody.num_images;
          
          const additionalResponse = await fetch(DOUBAO_SEEDREAM_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(additionalRequestBody)
          });

          if (additionalResponse.ok) {
            const additionalResult: DoubaoSeedreamResponse = await additionalResponse.json();
            if (additionalResult.data && additionalResult.data.length > 0) {
              allImageUrls.push(additionalResult.data[0].url);
              console.log(`✅ 第 ${i + 2} 次调用成功`);
            }
          } else {
            console.warn(`⚠️ 第 ${i + 2} 次调用失败`);
          }
          
          // 添加延迟避免触发限流
          if (i < remainingImages - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.warn(`⚠️ 第 ${i + 2} 次调用出错:`, error);
        }
      }
    }

    console.log(`📊 总共获得 ${allImageUrls.length} 张图片URL`);

    // 批量处理图像：下载、压缩为WebP、上传到OSS
    const processResults = await processAndUploadImagesBatch(
      allImageUrls,
      params.projectId,
      imageQuality,
      3,
      targetResizeOptions
    );

    // 检查处理结果
    const successfulResults = processResults.filter(result => result.success);
    if (successfulResults.length === 0) {
      throw new Error('所有图像处理都失败了');
    }

    // 构建返回结果
    const images = successfulResults.map(result => ({
      url: result.url!,
      ossKey: result.ossKey,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      compressionRatio: result.compressionRatio
    }));

    console.log("✅ 图像生成和上传完成:", {
      requested_images: requestedImages,
      total_generated: allImageUrls.length,
      successful_processed: successfulResults.length,
      failed_processed: processResults.length - successfulResults.length,
      images: images.map(img => img.url)
    });

    return {
      success: true,
      urls: images.map(img => img.url),
      ossKeys: images
        .map(img => img.ossKey)
        .filter((key): key is string => Boolean(key)),
      images: images
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    console.error("❌ doubao-seedream 生成失败:", errorMessage);
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * 批量生成图像
 * @param prompts 提示词数组
 * @param options 通用选项
 * @returns 返回生成结果数组
 */
export async function generateDoubaoSeedreamImagesBatch(
  prompts: string[],
  options: {
    negative_prompt?: string;
    image?: string | string[];
    size?: "2K" | "4K";
    num_images?: number;
    sequential_image_generation?: "disabled" | "auto";
    stream?: boolean;
    watermark?: boolean;
    seed?: number;
    projectId?: string;
    quality?: number | "standard" | "hd";
  } = {}
): Promise<Array<{ prompt: string; success: boolean; urls?: string[]; error?: string; images?: Array<{ url: string; originalSize?: number; compressedSize?: number; compressionRatio?: number }> }>> {
  const results = [];
  
  for (const prompt of prompts) {
    const result = await generateDoubaoSeedreamImage({
      prompt,
      ...options
    });
    
    results.push({
      prompt,
      ...result
    });
    
    // 添加延迟避免触发限流
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * 获取支持的图像尺寸列表
 */
export async function getSupportedImageSizes(): Promise<Array<{ value: string; label: string; ratio: string }>> {
  return [
    { value: "2K", label: "2K (2048×2048)", ratio: "1:1" },
    { value: "4K", label: "4K (4096×4096)", ratio: "1:1" },
  ];
}
