import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Schema } from '../../data/resource.js';
import { chunkText, embed } from '../shared/rag.js';

const database = DynamoDBDocumentClient.from(new DynamoDBClient({}));
type Event = Parameters<Schema['indexDocument']['functionHandler']>[0];

export const handler: Schema['indexDocument']['functionHandler'] = async (event: Event) => {
  const { knowledgeBaseId, filename, content } = event.arguments;
  const owner = (event.identity as { sub?: string } | undefined)?.sub;
  if (!owner) throw new Error('Authenticated user identity is required.');
  if (!/\.(txt|md|docx)$/i.test(filename)) throw new Error('Only .txt, .md, and .docx documents are supported by this endpoint.');
  if (content.length > 500_000) throw new Error('Document content must not exceed 500 KB.');

  const documentId = randomUUID();
  const now = new Date().toISOString();
  await database.send(new PutCommand({ TableName: process.env.DOCUMENT_TABLE, Item: {
    id: documentId, knowledgeBaseId, filename, fileType: filename.split('.').pop()?.toLowerCase() ?? 'txt',
    status: 'INDEXING', chunkCount: 0, owner, createdAt: now, updatedAt: now, __typename: 'Document',
  } }));

  try {
    const chunks = chunkText(content);
    if (!chunks.length) throw new Error('The document has no indexable text.');
    const vectors = await Promise.all(chunks.map((chunk) => embed([chunk]).then(([vector]) => vector)));
    await Promise.all(chunks.map((chunk, chunkIndex) => database.send(new PutCommand({ TableName: process.env.CHUNK_TABLE, Item: {
      id: randomUUID(), knowledgeBaseId, documentId, chunkIndex, content: chunk, embedding: JSON.stringify(vectors[chunkIndex]),
      tokenCount: chunk.length, owner, createdAt: now, updatedAt: now, __typename: 'KnowledgeChunk',
    } }))));
    await database.send(new UpdateCommand({ TableName: process.env.DOCUMENT_TABLE, Key: { id: documentId }, UpdateExpression: 'SET #status = :ready, chunkCount = :count, updatedAt = :now', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':ready': 'READY', ':count': chunks.length, ':now': new Date().toISOString() } }));
    await database.send(new UpdateCommand({ TableName: process.env.KNOWLEDGE_BASE_TABLE, Key: { id: knowledgeBaseId }, UpdateExpression: 'ADD documentCount :one, chunkCount :count SET updatedAt = :now', ExpressionAttributeValues: { ':one': 1, ':count': chunks.length, ':now': new Date().toISOString() } }));
    return { id: documentId, knowledgeBaseId, filename, fileType: filename.split('.').pop()?.toLowerCase() ?? 'txt', status: 'READY', chunkCount: chunks.length, owner, createdAt: now, updatedAt: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Indexing failed.';
    await database.send(new UpdateCommand({ TableName: process.env.DOCUMENT_TABLE, Key: { id: documentId }, UpdateExpression: 'SET #status = :failed, errorMessage = :message, updatedAt = :now', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':failed': 'FAILED', ':message': message, ':now': new Date().toISOString() } }));
    throw error;
  }
};
