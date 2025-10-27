import OSS from 'ali-oss';
import { getOSSStore } from './oss';

export interface ImageDownloadResult {
  ossKey: string;
  originalUrl: string;
  success: boolean;
  error?: string;
}

export class OSSImageManager {
  private ossClient: OSS | null = null;
  
  /**
   * 获取OSS客户端实例
   */
  getOSSClient(): OSS {
    if (!this.ossClient) {
      this.ossClient = getOSSStore();
    }
    return this.ossClient;
  }

  /**
   * 下载外部图像并保存到OSS
   */
  async downloadAndSaveImage(
    imageUrl: string,
    projectId: string,
    assetId: string,
    pageNumber: number
  ): Promise<ImageDownloadResult> {
    try {
      console.log(`下载图像 ${pageNumber}: ${imageUrl}`);
      
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

      // 获取图像数据
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        throw new Error('图像数据为空');
      }

      // 确定文件扩展名
      const contentType = response.headers.get('content-type') || '';
      let extension = 'jpg'; // 默认扩展名
      
      if (contentType.includes('png')) {
        extension = 'png';
      } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        extension = 'jpg';
      } else if (contentType.includes('webp')) {
        extension = 'webp';
      }

      // 生成OSS存储路径
      const timestamp = Date.now();
      const ossKey = `projects/${projectId}/assets/${assetId}/pages/page-${pageNumber}-${timestamp}.${extension}`;

      // 上传到OSS
      console.log(`上传图像到OSS: ${ossKey}`);
      await this.getOSSClient().put(ossKey, buffer, {
        headers: {
          'Content-Type': contentType || `image/${extension}`,
          'Cache-Control': 'public, max-age=31536000' // 1年缓存
        }
      });

      console.log(`图像 ${pageNumber} 保存成功: ${ossKey}`);

      return {
        ossKey,
        originalUrl: imageUrl,
        success: true
      };

    } catch (error) {
      console.error(`保存图像 ${pageNumber} 失败:`, error);
      return {
        ossKey: '',
        originalUrl: imageUrl,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 批量下载并保存图像
   */
  async downloadAndSaveImages(
    imageUrls: string[],
    projectId: string,
    assetId: string,
    options: {
      concurrency?: number;
      onProgress?: (completed: number, total: number, current?: ImageDownloadResult) => void;
    } = {}
  ): Promise<ImageDownloadResult[]> {
    const { concurrency = 3, onProgress } = options;
    const results: ImageDownloadResult[] = [];
    const total = imageUrls.length;

    console.log(`开始批量保存 ${total} 张图像到OSS，并发数: ${concurrency}`);

    // 分批处理，控制并发
    for (let i = 0; i < imageUrls.length; i += concurrency) {
      const batch = imageUrls.slice(i, i + concurrency);
      const batchPromises = batch.map((url, index) =>
        this.downloadAndSaveImage(url, projectId, assetId, i + index + 1)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 报告进度
      if (onProgress) {
        const lastResult = batchResults[batchResults.length - 1];
        onProgress(results.length, total, lastResult);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`图像保存完成: 成功 ${successCount}/${total}，失败 ${failureCount}`);

    return results;
  }

  /**
   * 为OSS图像生成带签名的访问URL
   */
  generateSignedImageUrl(
    ossKey: string,
    expiresInDays: number = 30,
    process?: string   // 新增参数，可选，比如 "image/format,webp/quality,q_75"
  ): string {
    try {
      const expiresInSeconds = expiresInDays * 24 * 60 * 60;
  
      const options: OSS.SignatureUrlOptions = {
        expires: expiresInSeconds,
        method: 'GET'
      };
  
      // 如果传入了图片处理规则，加上 process
      if (process) {
        options.process = process;
      }
  
      const signedUrl = this.getOSSClient().signatureUrl(ossKey, options);
  
      return signedUrl;
    } catch (error) {
      console.error(`生成签名URL失败 (${ossKey}):`, error);
      throw new Error(
        `生成图像访问链接失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }
  

  /**
   * 批量生成签名URL
   */
  generateSignedImageUrls(
    ossKeys: string[],
    expiresInDays: number = 30
  ): { [ossKey: string]: string } {
    const urls: { [ossKey: string]: string } = {};
    
    for (const ossKey of ossKeys) {
      try {
        urls[ossKey] = this.generateSignedImageUrl(ossKey, expiresInDays);
      } catch {
        console.error(`为 ${ossKey} 生成签名URL失败`);
        // 继续处理其他URL，不中断整个过程
      }
    }
    
    return urls;
  }

  /**
   * 检查OSS对象是否存在
   */
  async checkImageExists(ossKey: string): Promise<boolean> {
    try {
      await this.getOSSClient().head(ossKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 删除OSS图像
   */
  async deleteImage(ossKey: string): Promise<boolean> {
    try {
      await this.getOSSClient().delete(ossKey);
      console.log(`删除OSS图像成功: ${ossKey}`);
      return true;
    } catch {
      console.error(`删除OSS图像失败: ${ossKey}`);
      return false;
    }
  }

  /**
   * 批量删除图像
   */
  async deleteImages(ossKeys: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];

    for (const ossKey of ossKeys) {
      const success = await this.deleteImage(ossKey);
      if (success) {
        deleted.push(ossKey);
      } else {
        failed.push(ossKey);
      }
    }

    return { deleted, failed };
  }
}

// 导出单例实例
export const ossImageManager = new OSSImageManager();
