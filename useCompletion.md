# useCompletion 前后端开发规范

基于当前项目的实际实现，总结 `useCompletion` 的前后端开发规范和最佳实践。

## 1. 前端 useCompletion 使用规范

### 1.1 基本配置结构

```typescript
import { useCompletion } from "@ai-sdk/react";

const { completion, complete, isLoading, error, stop, setCompletion } = useCompletion({
  api: '/api/your-endpoint',
  body: {
    // 静态参数
    worldviewId: worldviewId,
    episodeRange: getNextEpisodeRange(episodeStep),
  },
  experimental_throttle: 50,
  onFinish: async (_prompt, completion) => {
    // 完成后的处理逻辑
  },
  onError: (err) => {
    console.error('生成失败:', err);
  },
});
```

### 1.2 必需的状态管理

```typescript
// 基础状态
const [editableTitle, setEditableTitle] = useState('');
const [editableContent, setEditableContent] = useState('');

// 业务逻辑状态
const [episodeStep, setEpisodeStep] = useState(defaultEpisodeStep);
```

### 1.3 onFinish 回调最佳实践

```typescript
onFinish: async (_prompt, completion) => {
  // 1. 计算业务数据
  const episodeRange = getNextEpisodeRange(episodeStep);
  const nextIndex = outlinesCount > 0 ? Math.max(...Array.from({length: outlinesCount}, (_, i) => i)) + 1 : 0;
  const title = `第${episodeRange}集大纲`;
  
  // 2. 调用保存 API
  try {
    const saveResponse = await fetch('/api/outline/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        content: completion.trim(), // 注意 trim()
        worldviewId: worldviewId,
        index: nextIndex,
        // 其他业务字段...
      }),
    });

    if (saveResponse.ok) {
      const saved = await saveResponse.json();
      onOutlineGenerated({ ...saved.outline, chapters: [] });
      // 3. 清理状态
      setEditableTitle('');
      setEditableContent('');
      setCompletion('');
    } else {
      alert('保存失败');
    }
  } catch (error) {
    console.error('Save error:', error);
    alert('保存失败');
  }
},
```

### 1.4 错误处理规范

```typescript
onError: (err) => {
  console.error('生成大纲失败:', err);
},

// 在组件中显示错误
{error && (
  <div className="text-red-500 text-sm">
    生成失败：{error.message}
  </div>
)}
```

### 1.5 complete() 函数使用规范

```typescript
// 1. 使用 complete() 直接触发生成（推荐方式）
const handleGenerate = async () => {
  try {
    // 清空之前的内容
    setCompletion('');
    
    // 方式1: 使用描述性提示词
    await complete('请生成大纲内容');
    
    // 方式2: 使用空字符串（当API端点已有完整上下文）
    await complete('');
    
    // 方式3: 使用JSON数据作为提示词
    const config = { type: 'outline', episodes: episodeRange };
    await complete(JSON.stringify(config));
    
    // 方式4: 使用body参数传递额外数据
    await complete('生成提示', { 
      body: { 
        customData: 'additional context' 
      } 
    });
    
  } catch (error) {
    console.error('生成失败:', error);
  }
};

// UI 交互
<div className="space-y-4">
  <div className="flex items-center gap-3">
    <Button 
      onClick={handleGenerate} 
      disabled={isLoading}
    >
      {isLoading ? '生成中...' : '开始生成'}
    </Button>
    {isLoading && (
      <Button variant="outline" onClick={stop}>
        停止
      </Button>
    )}
  </div>
  
  {/* 自动触发场景示例 */}
  <Button 
    onClick={() => complete('请生成模拟沟通建议')}
    disabled={isLoading}
  >
    生成沟通建议
  </Button>
</div>

// 实时预览
{isLoading && completion && (
  <div className="mt-4">
    <label className="block text-sm font-medium mb-2">生成预览</label>
    <div className="max-h-60 overflow-y-auto border rounded-lg p-3 bg-muted">
      <div className="prose max-w-none text-sm">
        <MarkdownRenderer content={completion} />
      </div>
    </div>
  </div>
)}
```

## 2. 后端 API 开发规范

### 2.1 路由结构规范

```typescript
// app/api/[feature]/generate/route.ts
import { deepseek } from '@ai-sdk/deepseek';
import { streamText } from 'ai';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    // 1. 参数解析和验证
    const { worldviewId, episodeRange, input }: { 
      worldviewId: string; 
      episodeRange: string;
      input?: string; 
    } = await req.json();

    if (!worldviewId || !episodeRange) {
      return new Response('Missing required fields', { status: 400 });
    }

    // 2. 数据库查询
    // 3. 提示词构建
    // 4. AI 调用
    // 5. 返回流式响应
    
  } catch (error) {
    console.error('Error generating:', error);
    return new Response('生成失败', { status: 500 });
  }
}
```

### 2.2 数据库查询模式

```typescript
// 获取主要资源
const worldview = await db.worldviews.findUnique({
  where: { id: worldviewId },
});

if (!worldview) {
  return new Response('世界观未找到', { status: 404 });
}

// 获取系统提示词
const systemPrompt = await db.prompt.findFirst({
  where: { name: "大纲" },
});

// 获取历史数据用于上下文
const historyOutlines = await db.outlines.findMany({
  where: { worldviewId },
  orderBy: { index: 'asc' },
});
```

### 2.3 提示词构建规范

```typescript
// 系统提示词 - 使用数据库存储或默认值
const systemContent = systemPrompt?.content || `你是编剧助理。根据给定的世界观与集数范围，输出结构化且详细的剧情大纲。
要求：
1. 大纲需包含主线、支线与人物弧光
2. 使用分点或分节方式组织内容，条理清晰
3. 如有多集范围，按集分段给出要点
4. 中文输出。`;

// 用户提示词 - 结构化组织
const historyOutlinesContent = historyOutlines.map((outline) => outline.content).join('\n');

const userPrompt = `
先前内容回顾：
${historyOutlinesContent}

基于以下世界观内容，为第${episodeRange}集创建大纲：

世界观内容：
${worldview.content}

用户指示：${input || '生成下一个片段'}

请为第${episodeRange}集创建详细的大纲。`;
```

### 2.4 AI 调用规范

```typescript
const result = streamText({
  model: deepseek('deepseek-chat'),
  system: systemContent,
  prompt: userPrompt,
  onChunk: (chunk) => {
    // 便于排查"没反应"问题，观察是否有流式片段产出
  }
});

return result.toUIMessageStreamResponse();
```

### 2.5 错误处理规范

```typescript
// 参数验证
if (!worldviewId || !episodeRange) {
  return new Response('Missing required fields', { status: 400 });
}

// 资源不存在
if (!worldview) {
  return new Response('世界观未找到', { status: 404 });
}

// 统一异常处理
try {
  // 业务逻辑
} catch (error) {
  console.error('Error generating outline:', error);
  return new Response('生成大纲失败', { status: 500 });
}
```

## 3. 聊天场景的特殊规范

### 3.1 聊天 API 结构

```typescript
// 支持消息历史的聊天场景
export async function POST(req: Request) {
  const { messages, chatId, projectId }: { 
    messages: UIMessage[]; 
    chatId?: string;
    projectId?: string;
  } = await req.json();

  // 聊天 ID 管理
  let actualChatId = chatId;
  if (!actualChatId && projectId) {
    actualChatId = await createChat(projectId);
  }

  // 权限验证
  if (actualChatId && projectId) {
    const isValid = await verifyChatProject(actualChatId, projectId);
    if (!isValid) {
      return new Response("Chat does not belong to project", { status: 403 });
    }
  }

  const result = streamText({
    model: deepseek('deepseek-chat'),
    system: prompt.content,
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: createIdGenerator({
      prefix: 'msg',
      size: 16,
    }),
    onFinish: async ({ messages: finalMessages }) => {
      if (actualChatId) {
        await saveChat({ 
          chatId: actualChatId, 
          messages: finalMessages 
        });
      }
    },
  });
}
```

## 4. 后台生成模式规范

### 4.1 后台生成 API 结构

```typescript
// 使用 generateText 而非 streamText
import { generateText } from 'ai';

export async function POST(req: Request) {
  try {
    const { text } = await generateText({
      model: deepseek('deepseek-chat'),
      system: systemPrompt.content,
      prompt: userPrompt,
    });

    // 直接保存到数据库
    const worldview = await db.worldviews.create({
      data: {
        name: worldviewName,
        description: worldviewDescription,
        content: text.trim(),
        projectId,
      },
    });

    // 返回 JSON 响应
    return Response.json({
      success: true,
      worldview: {
        id: worldview.id,
        name: worldview.name,
        description: worldview.description || undefined,
        content: worldview.content,
        createdAt: worldview.createdAt,
        updatedAt: worldview.updatedAt,
        projectId: worldview.projectId,
      },
    });
  } catch (error) {
    console.error('后台生成失败:', error);
    return new Response('后台生成失败', { status: 500 });
  }
}
```

## 5. 最佳实践总结

### 5.1 前端最佳实践

1. **状态清理**：调用 `complete()` 前使用 `setCompletion('')` 清理之前的内容
2. **错误处理**：使用 try-catch 包装 `complete()` 调用
3. **加载状态**：提供清晰的加载状态和停止功能
4. **实时预览**：在生成过程中提供内容预览
5. **自动触发**：在 useEffect 中调用 `complete()` 实现自动生成
6. **手动触发**：在用户交互事件中调用 `complete()` 实现按需生成
7. **多种调用方式**：根据场景选择合适的 `complete()` 参数模式

### 5.2 后端最佳实践

1. **参数验证**：严格验证必需参数
2. **资源检查**：验证关联资源是否存在
3. **错误处理**：统一的错误响应格式
4. **日志记录**：记录关键操作和错误信息
5. **数据库事务**：涉及多表操作时使用事务

### 5.3 性能优化

1. **流式响应**：使用 `streamText` 提供流式体验
2. **节流控制**：设置 `experimental_throttle: 50` 控制更新频率
3. **内容裁剪**：保存前使用 `trim()` 清理内容
4. **历史限制**：合理控制历史数据的查询范围

### 5.4 安全规范

1. **权限验证**：验证用户对资源的访问权限
2. **输入清理**：对用户输入进行适当的清理和验证
3. **错误信息**：避免在错误信息中暴露敏感信息

## 6. 项目特定规范

### 6.1 模型选择
- 统一使用 `deepseek('deepseek-chat')` 模型
- 通过数据库存储和管理系统提示词，一般使用Prompt表

### 6.2 数据库设计
- 使用 Prisma ORM 进行数据库操作
- 使用 `npx prisma migrate dev` 而非 `npx prisma db push`
- 维护历史数据用于上下文构建

### 6.3 UI 组件
- 基于 shadcn/ui 组件库
- 支持响应式设计（PC、手机端）
- 使用 MarkdownRenderer 渲染 AI 生成内容

## 7. complete() 函数使用模式总结

### 7.1 常见调用模式

```typescript
// 模式1: 描述性提示词（适用于需要明确指令的场景）
await complete('请生成模拟沟通建议');
await complete('请你根据内容生成');
await complete('请根据当前通话内容生成推荐回复');

// 模式2: 空字符串（适用于API端点已有完整上下文的场景）
await complete('');

// 模式4: 带额外body参数（适用于需要传递额外上下文数据的场景）
await complete('', { body: payload });
```

### 7.2 与传统表单模式的对比

| 特性 | complete() 模式 | 传统表单模式 |
|------|----------------|-------------|
| 触发方式 | 程序化调用 | 用户表单提交 |
| 输入源 | 代码中定义 | 用户输入框 |
| 适用场景 | 自动化生成、上下文驱动 | 用户主导的自由输入 |
| 状态管理 | 更简单，无需input状态 | 需要管理input状态 |
| 用户体验 | 一键生成，操作简单 | 需要用户输入，更灵活 |

### 7.3 实际项目应用示例

```typescript
// 销售策略页面 - 自动触发生成
useEffect(() => {
  if (shouldAutoGenerate) {
    complete('');
  }
}, [dependencies]);

// 测验判题 - 带数据负载
const handleJudging = async () => {
  const payload = { questionId, userAnswer, context };
  await complete('', { body: payload });
};

// 项目生成 - 描述性提示
const generateProjectInfo = () => {
  complete('请你根据内容生成');
};

// 沟通建议 - 上下文相关提示
const generateTips = () => {
  complete('请生成模拟沟通建议');
};
```

这份规范基于项目中的实际 Good Case 总结，重点突出了 `complete()` 函数的使用模式，为后续开发提供统一的标准和最佳实践。
