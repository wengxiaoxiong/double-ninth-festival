"use server";

import sharp, { type ResizeOptions } from "sharp";
import { ossImageManager } from "./oss-image";

// 图像处理结果接口
export interface ImageProcessResult {
  success: boolean;
  url?: string;
  ossKey?: string;
  error?: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
}

/**
 * 处理单张图像：下载、压缩为WebP、上传到OSS
 * @param imageUrl 原始图像URL
 * @param projectId 项目ID
 * @param fileName 文件名（可选，默认自动生成）
 * @param quality 图像质量 (1-100)
 * @returns 处理结果
 */
export async function processAndUploadImage(
  imageUrl: string,
  projectId?: string,
  fileName?: string,
  quality: number = 80,
  resizeOptions?: ResizeOptions
): Promise<ImageProcessResult> {
  try {
    console.log(`🖼️ 开始处理图像: ${imageUrl}`);

    // 下载图像
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }

    // 获取原始图像数据
    const arrayBuffer = await response.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);
    const originalSize = originalBuffer.length;

    if (originalSize === 0) {
      throw new Error('图像数据为空');
    }

    console.log(`📥 图像下载完成，原始大小: ${(originalSize / 1024).toFixed(2)} KB`);

    // 使用sharp处理图像：转换为WebP格式并压缩
    let sharpInstance = sharp(originalBuffer);

    if (resizeOptions) {
      sharpInstance = sharpInstance.resize(resizeOptions);
    }

    const processedBuffer = await sharpInstance
      .webp({ 
        quality: quality,
        effort: 6 // 更高的压缩努力，更好的压缩比
      })
      .toBuffer();

    const compressedSize = processedBuffer.length;
    const compressionRatio = originalSize > 0 ? ((originalSize - compressedSize) / originalSize * 100) : 0;

    console.log(`🗜️ 图像压缩完成:`, {
      originalSize: `${(originalSize / 1024).toFixed(2)} KB`,
      compressedSize: `${(compressedSize / 1024).toFixed(2)} KB`,
      compressionRatio: `${compressionRatio.toFixed(1)}%`
    });

    // 生成OSS存储路径
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const ossKey = fileName 
      ? `generated-images/${projectId || 'default'}/${fileName}`
      : `generated-images/${projectId || 'default'}/${timestamp}-${randomId}.webp`;

    // 上传到OSS
    console.log(`☁️ 上传图像到OSS: ${ossKey}`);
    await ossImageManager.getOSSClient().put(ossKey, processedBuffer, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000' // 1年缓存
      }
    });

    // 生成带签名的访问URL
    const signedUrl = ossImageManager.generateSignedImageUrl(ossKey, 30);

    console.log(`✅ 图像处理完成: ${signedUrl}`);

    return {
      success: true,
      url: signedUrl,
      ossKey,
      originalSize,
      compressedSize,
      compressionRatio
    };

  } catch (error) {
    console.error(`❌ 图像处理失败:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 批量处理图像：下载、压缩为WebP、上传到OSS
 * @param imageUrls 图像URL数组
 * @param projectId 项目ID
 * @param quality 图像质量 (1-100)
 * @param concurrency 并发数
 * @returns 处理结果数组
 */
export async function processAndUploadImagesBatch(
  imageUrls: string[],
  projectId?: string,
  quality: number = 80,
  concurrency: number = 3,
  resizeOptions?: ResizeOptions
): Promise<ImageProcessResult[]> {
  const results: ImageProcessResult[] = [];
  const total = imageUrls.length;

  console.log(`🔄 开始批量处理 ${total} 张图像，并发数: ${concurrency}`);

  // 分批处理，控制并发
  for (let i = 0; i < imageUrls.length; i += concurrency) {
    const batch = imageUrls.slice(i, i + concurrency);
    const batchPromises = batch.map((url, index) => {
      const fileName = `batch-${i + index + 1}-${Date.now()}.webp`;
      return processAndUploadImage(url, projectId, fileName, quality, resizeOptions);
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    console.log(`📊 批次 ${Math.floor(i / concurrency) + 1} 完成: ${batchResults.filter(r => r.success).length}/${batch.length} 成功`);
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  console.log(`✅ 批量图像处理完成: 成功 ${successCount}/${total}，失败 ${failureCount}`);

  return results;
}

/**
 * 从OSS URL获取图像信息
 * @param ossUrl OSS URL
 * @returns 图像信息
 */
export async function getImageInfo(ossUrl: string): Promise<{
  width?: number;
  height?: number;
  format?: string;
  size?: number;
} | null> {
  try {
    const response = await fetch(ossUrl);
    if (!response.ok) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);
    
    const metadata = await sharp(imageBuffer).metadata();
    
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: imageBuffer.length
    };
  } catch (error) {
    console.error('获取图像信息失败:', error);
    return null;
  }
}

/**
 * 生成图像缩略图
 * @param imageUrl 原始图像URL
 * @param width 缩略图宽度
 * @param height 缩略图高度
 * @param projectId 项目ID
 * @returns 缩略图URL
 */
export async function generateThumbnail(
  imageUrl: string,
  width: number = 300,
  height: number = 300,
  projectId?: string
): Promise<ImageProcessResult> {
  try {
    console.log(`🖼️ 生成缩略图: ${width}x${height}`);

    // 下载原始图像
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    // 生成缩略图
    const thumbnailBuffer = await sharp(originalBuffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 85 })
      .toBuffer();

    // 生成OSS存储路径
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const ossKey = `thumbnails/${projectId || 'default'}/${timestamp}-${randomId}-${width}x${height}.webp`;

    // 上传缩略图到OSS
    await ossImageManager.getOSSClient().put(ossKey, thumbnailBuffer, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000'
      }
    });

    // 生成带签名的访问URL
    const signedUrl = ossImageManager.generateSignedImageUrl(ossKey, 30);

    console.log(`✅ 缩略图生成完成: ${signedUrl}`);

    return {
      success: true,
      url: signedUrl,
      ossKey,
      originalSize: originalBuffer.length,
      compressedSize: thumbnailBuffer.length,
      compressionRatio: ((originalBuffer.length - thumbnailBuffer.length) / originalBuffer.length * 100)
    };

  } catch (error) {
    console.error(`❌ 缩略图生成失败:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}
