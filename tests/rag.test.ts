import { describe, expect, it } from 'vitest';
import { chunkText, cosineSimilarity } from '../amplify/functions/shared/rag.js';
import { operationName } from '../amplify/functions/application/handler.js';

describe('RAG helpers', () => {
  it('uses reference-project chunking defaults with overlap', () => {
    const text = `${'甲'.repeat(600)}\n\n${'乙'.repeat(600)}`;
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((chunk) => chunk.length > 600)).toBe(true);
    expect(chunks.some((chunk) => chunk.includes('甲'.repeat(80)))).toBe(true);
  });

  it('scores identical vectors at one', () => {
    expect(cosineSimilarity([1, 2], [1, 2])).toBeCloseTo(1);
  });

  it('keeps short non-empty text indexable', () => {
    expect(chunkText('测试')).toEqual(['测试']);
  });

  it('dispatches Amplify function events without GraphQL resolver info', () => {
    expect(operationName({ arguments: { conversationId: 'conversation', message: '问题' } })).toBe('completeChat');
  });
});
