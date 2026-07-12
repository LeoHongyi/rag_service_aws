import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const bedrock = new BedrockRuntimeClient({});
const secrets = new SecretsManagerClient({});
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let dashscopeApiKey: string | undefined;

const provider = () => process.env.LLM_PROVIDER ?? 'dashscope';

async function getDashscopeApiKey(): Promise<string> {
  if (dashscopeApiKey) return dashscopeApiKey;
  const secretId = process.env.DASHSCOPE_SECRET_ID;
  if (!secretId) throw new Error('DASHSCOPE_SECRET_ID is not configured.');
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!response.SecretString) throw new Error('DashScope API key secret has no string value.');
  dashscopeApiKey = response.SecretString.trim();
  return dashscopeApiKey;
}

async function dashscopeRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await getDashscopeApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`DashScope request failed (${response.status}): ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

export function chunkText(text: string, chunkSize = 600, overlap = 80): string[] {
  const paragraphs = text.replace(/\r\n?/g, '\n').split(/\n{2,}/).map((part) => part.trim()).filter((part) => part.length >= 20);
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize) {
      if (current) chunks.push(current);
      current = '';
      for (let position = 0; position < paragraph.length; position += chunkSize - overlap) {
        const slice = paragraph.slice(position, position + chunkSize).trim();
        if (slice.length >= 20) chunks.push(slice);
      }
      continue;
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= chunkSize) current = candidate;
    else { chunks.push(current); current = `${current.slice(-overlap)}\n\n${paragraph}`; }
  }
  if (current.trim().length >= 20) chunks.push(current.trim());
  return chunks;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (provider() === 'dashscope') {
    const response = await dashscopeRequest<{ data?: Array<{ embedding?: number[]; index?: number }> }>('/embeddings', {
      model: process.env.EMBEDDING_MODEL_ID ?? 'text-embedding-v3',
      input: texts,
    });
    const vectors = (response.data ?? []).sort((left, right) => (left.index ?? 0) - (right.index ?? 0)).map((item) => item.embedding);
    if (vectors.length !== texts.length || vectors.some((vector) => !vector?.length)) throw new Error('DashScope embedding response is incomplete.');
    return vectors as number[][];
  }
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: process.env.EMBEDDING_MODEL_ID ?? 'amazon.titan-embed-text-v2:0',
    contentType: 'application/json', accept: 'application/json',
    body: encoder.encode(JSON.stringify({ inputText: texts[0], dimensions: 1024, normalize: true })),
  }));
  if (texts.length !== 1) return Promise.all(texts.map((text) => embed([text]).then(([vector]) => vector)));
  return [JSON.parse(decoder.decode(response.body)).embedding as number[]];
}

export function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let i = 0; i < left.length; i += 1) { dot += left[i] * right[i]; leftNorm += left[i] ** 2; rightNorm += right[i] ** 2; }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

export async function answerQuestion(question: string, context: string): Promise<string> {
  if (provider() === 'dashscope') {
    const response = await dashscopeRequest<{ choices?: Array<{ message?: { content?: string } }> }>('/chat/completions', {
      model: process.env.CHAT_MODEL_ID ?? 'qwen-plus',
      messages: [
        { role: 'system', content: '你是中文知识库助手。请准确、简洁地回答；当上下文不足时，明确说明无法从已提供内容确定。' },
        { role: 'user', content: `上下文：\n${context}\n\n问题：${question}` },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('DashScope chat model returned no text response.');
    return text;
  }
  const response = await bedrock.send(new ConverseCommand({
    modelId: process.env.CHAT_MODEL_ID ?? 'qwen.qwen3-32b-v1:0',
    system: [{ text: '你是中文知识库助手。请准确、简洁地回答；当上下文不足时，明确说明无法从已提供内容确定。' }],
    messages: [{ role: 'user', content: [{ text: `上下文：\n${context}\n\n问题：${question}` }] }],
    inferenceConfig: { maxTokens: 1024, temperature: 0.3 },
  }));
  const content = response.output?.message?.content ?? [];
  const text = content.find((block) => 'text' in block)?.text;
  if (!text) throw new Error('Chat model returned no text response.');
  return text;
}
