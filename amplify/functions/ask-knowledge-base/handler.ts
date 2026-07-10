import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Schema } from '../../data/resource.js';
import { answerQuestion, cosineSimilarity, embed } from '../shared/rag.js';

const database = DynamoDBDocumentClient.from(new DynamoDBClient({}));
type Event = Parameters<Schema['askKnowledgeBase']['functionHandler']>[0];
type Chunk = { id: string; documentId: string; content: string; embedding: string; chunkIndex: number };

export const handler: Schema['askKnowledgeBase']['functionHandler'] = async (event: Event) => {
  const { knowledgeBaseId, question, topK } = event.arguments;
  const resultLimit = topK ?? 5;
  if (!question.trim()) throw new Error('Question cannot be empty.');
  const result = await database.send(new QueryCommand({
    TableName: process.env.CHUNK_TABLE, IndexName: 'knowledgeBaseId-documentId-chunkIndex-index',
    KeyConditionExpression: 'knowledgeBaseId = :knowledgeBaseId', ExpressionAttributeValues: { ':knowledgeBaseId': knowledgeBaseId },
  }));
  const chunks = (result.Items ?? []) as Chunk[];
  if (!chunks.length) return { answer: '这个知识库中还没有可检索的文档。', sources: [] };
  const [questionEmbedding] = await embed([question]);
  const matches = chunks.map((chunk) => ({ ...chunk, score: cosineSimilarity(questionEmbedding, JSON.parse(chunk.embedding) as number[]) }))
    .sort((left, right) => right.score - left.score).slice(0, Math.min(Math.max(resultLimit, 1), 10));
  const context = matches.map((match, index) => `[${index + 1}] ${match.content}`).join('\n\n');
  const answer = await answerQuestion(question, context);
  return { answer, sources: matches.map(({ id, documentId, chunkIndex, content, score }) => ({ id, documentId, chunkIndex, content, score })) };
};
