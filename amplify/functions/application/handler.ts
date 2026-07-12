import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { answerQuestion, cosineSimilarity, embed } from '../shared/rag.js';

const database = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const storage = new S3Client({});
const bedrock = new BedrockRuntimeClient({});
const decoder = new TextDecoder();
const plans = {
  EXPERIENCE: { name: '体验券', amountCents: 990, tokenBonus: 200000, imageLimit: 4 },
  SOURCE: { name: '源码版', amountCents: 49900, tokenBonus: 1000000, imageLimit: 4 },
} as const;

type GraphqlEvent = { arguments: Record<string, unknown>; identity?: { sub?: string }; info?: { fieldName?: string }; fieldName?: string };
type Chunk = { id: string; documentId: string; content: string; embedding: string; chunkIndex: number };

const table = (name: string) => process.env[`${name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_TABLE`] as string;
const now = () => new Date().toISOString();

export const handler = async (event: GraphqlEvent) => {
  const operation = operationName(event);
  switch (operation) {
    case 'completeChat': return completeChat(event);
    case 'generateImage': return generateImage(event);
    case 'createPayment': return createPayment(event);
    case 'paymentPlans': return Object.entries(plans).map(([key, value]) => ({ key, ...value }));
    default: throw new Error(`Unsupported application operation: ${operation || 'unknown'}`);
  }
};

export function operationName(event: GraphqlEvent): string {
  if (event.info?.fieldName) return event.info.fieldName;
  if (event.fieldName) return event.fieldName;
  if ('conversationId' in event.arguments && 'message' in event.arguments) return 'completeChat';
  if ('prompt' in event.arguments) return 'generateImage';
  if ('planType' in event.arguments && 'channel' in event.arguments) return 'createPayment';
  if (!Object.keys(event.arguments).length) return 'paymentPlans';
  return '';
}

async function completeChat(event: GraphqlEvent) {
  const owner = event.identity?.sub;
  const { conversationId, message, knowledgeBaseIds = [], contentType = 'TEXT' } = event.arguments as { conversationId: string; message: string; knowledgeBaseIds?: string[]; contentType?: string };
  if (!owner || !message?.trim()) throw new Error('An authenticated user and a message are required.');
  const conversation = await database.send(new GetCommand({ TableName: table('Conversation'), Key: { id: conversationId } }));
  if (!conversation.Item || conversation.Item.owner !== owner) throw new Error('Conversation not found.');

  const userMessageId = randomUUID();
  await database.send(new PutCommand({ TableName: table('ChatMessage'), Item: { id: userMessageId, conversationId, role: 'USER', content: message.trim(), contentType, owner, tokensUsed: 0, createdAt: now(), updatedAt: now(), __typename: 'ChatMessage' } }));
  const sources = await retrieveSources(knowledgeBaseIds, message);
  const history = await database.send(new QueryCommand({ TableName: table('ChatMessage'), IndexName: 'conversationId-index', KeyConditionExpression: 'conversationId = :conversationId', ExpressionAttributeValues: { ':conversationId': conversationId }, Limit: 100 }));
  const historyText = (history.Items ?? []).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))).slice(-12).map((item) => `${item.role}: ${item.content}`).join('\n');
  const context = sources.map((source, index) => `[知识库 ${index + 1}，${source.filename}]\n${source.content}`).join('\n\n');
  const prompt = context ? `对话历史：\n${historyText}\n\n检索到的知识库：\n${context}` : `对话历史：\n${historyText}`;
  const content = await answerQuestion(message, prompt);
  const messageId = randomUUID();
  const tokensUsed = Math.ceil((message.length + content.length) / 4);
  const needsHuman = /投诉|人工|退款|欺骗|骗子|投诉|不满/.test(message);
  await database.send(new PutCommand({ TableName: table('ChatMessage'), Item: { id: messageId, conversationId, role: 'ASSISTANT', content, contentType: 'TEXT', modelUsed: process.env.CHAT_MODEL_ID, tokensUsed, ragSources: sources.map(({ filename, documentId }) => ({ filename, documentId })), owner, createdAt: now(), updatedAt: now(), __typename: 'ChatMessage' } }));
  await database.send(new UpdateCommand({ TableName: table('Conversation'), Key: { id: conversationId }, UpdateExpression: 'SET title = if_not_exists(title, :title), updatedAt = :updatedAt', ExpressionAttributeValues: { ':title': message.slice(0, 20), ':updatedAt': now() } }));
  if (needsHuman) await database.send(new PutCommand({ TableName: table('SupportTicket'), Item: { id: randomUUID(), conversationId, lastUserMessage: message.slice(0, 500), emotion: 'negative', needsHuman: true, status: 'PENDING', owner, createdAt: now(), updatedAt: now(), __typename: 'SupportTicket' } }));
  return { messageId, content, tokensUsed, ragSources: sources, needsHuman };
}

async function retrieveSources(knowledgeBaseIds: string[], question: string) {
  if (!knowledgeBaseIds.length) return [] as Array<Chunk & { filename: string; score: number }>;
  const [questionEmbedding] = await embed([question]);
  const chunks = (await Promise.all(knowledgeBaseIds.map(async (knowledgeBaseId) => {
    const result = await database.send(new QueryCommand({ TableName: table('KnowledgeChunk'), IndexName: 'knowledgeBaseId-documentId-chunkIndex-index', KeyConditionExpression: 'knowledgeBaseId = :knowledgeBaseId', ExpressionAttributeValues: { ':knowledgeBaseId': knowledgeBaseId } }));
    return (result.Items ?? []) as Chunk[];
  }))).flat();
  const documentIds = [...new Set(chunks.map((chunk) => chunk.documentId))];
  const documents = await Promise.all(documentIds.map((id) => database.send(new GetCommand({ TableName: table('Document'), Key: { id } }))));
  const filenames = new Map(documents.filter((result) => result.Item).map((result) => [result.Item!.id as string, result.Item!.filename as string]));
  return chunks.map((chunk) => ({ ...chunk, filename: filenames.get(chunk.documentId) ?? '未知文档', score: cosineSimilarity(questionEmbedding, JSON.parse(chunk.embedding) as number[]) }))
    .sort((left, right) => right.score - left.score).slice(0, 5);
}

async function generateImage(event: GraphqlEvent) {
  const owner = event.identity?.sub;
  const { prompt } = event.arguments as { prompt: string };
  if (!owner || !prompt?.trim()) throw new Error('An authenticated user and a prompt are required.');
  const profile = await database.send(new GetCommand({ TableName: table('UserProfile'), Key: { id: owner } }));
  const plan = profile.Item?.planType as keyof typeof plans | undefined;
  const imageLimit = plan ? plans[plan].imageLimit : 0;
  const imagesUsed = Number(profile.Item?.imagesUsed ?? 0);
  if (imageLimit === 0 || imagesUsed >= imageLimit) throw new Error('Image generation is unavailable for the current plan.');
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: process.env.IMAGE_MODEL_ID,
    contentType: 'application/json', accept: 'application/json',
    body: Buffer.from(JSON.stringify({ taskType: 'TEXT_IMAGE', textToImageParams: { text: prompt }, imageGenerationConfig: { numberOfImages: 1, quality: 'standard', height: 1024, width: 1024, cfgScale: 7, seed: 0 } })),
  }));
  const payload = JSON.parse(decoder.decode(response.body)) as { images?: string[]; error?: string };
  if (!payload.images?.[0]) throw new Error(payload.error ?? 'Image model returned no image.');
  const imageKey = `generated/${owner}/${randomUUID()}.png`;
  await storage.send(new PutObjectCommand({ Bucket: process.env.RAG_DOCUMENTS_BUCKET, Key: imageKey, Body: Buffer.from(payload.images[0], 'base64'), ContentType: 'image/png' }));
  await database.send(new UpdateCommand({ TableName: table('UserProfile'), Key: { id: owner }, UpdateExpression: 'SET imagesUsed = :imagesUsed, updatedAt = :updatedAt', ExpressionAttributeValues: { ':imagesUsed': imagesUsed + 1, ':updatedAt': now() } }));
  return { imageUrl: imageKey, imagesUsed: imagesUsed + 1, imageLimit };
}

async function createPayment(event: GraphqlEvent) {
  const owner = event.identity?.sub;
  const { planType, channel } = event.arguments as { planType: keyof typeof plans; channel: string };
  const plan = plans[planType];
  if (!owner || !plan || !['NATIVE', 'JSAPI'].includes(channel)) throw new Error('Invalid payment request.');
  const id = randomUUID(); const orderNumber = `RAG${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await database.send(new PutCommand({ TableName: table('PaymentOrder'), Item: { id, orderNumber, amountCents: plan.amountCents, planType, status: 'PENDING', owner, createdAt: now(), updatedAt: now(), __typename: 'PaymentOrder' } }));
  return { orderId: id, orderNumber, amountCents: plan.amountCents, paymentPayload: { channel, status: 'PENDING', message: 'Configure the selected payment provider webhook before collecting payment.' } };
}
