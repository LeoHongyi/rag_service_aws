import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({});
const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: process.env.CHAT_MODEL_ID ?? 'anthropic.claude-3-haiku-20240307-v1:0', contentType: 'application/json', accept: 'application/json',
    body: encoder.encode(JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', max_tokens: 1024, messages: [{ role: 'user', content: `请仅根据以下知识库内容回答问题。若内容不足，请明确说明。\n\n知识库：\n${context}\n\n问题：${question}` }] })),
  }));
  return JSON.parse(decoder.decode(response.body)).content[0].text as string;
}
