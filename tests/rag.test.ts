import { describe, expect, it } from 'vitest';
import { chunkText, cosineSimilarity } from '../amplify/functions/shared/rag.js';

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
});
