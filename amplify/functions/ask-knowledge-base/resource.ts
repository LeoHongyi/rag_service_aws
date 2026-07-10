import { defineFunction } from '@aws-amplify/backend';

export const askKnowledgeBase = defineFunction({
  name: 'ask-knowledge-base', entry: './handler.ts', timeoutSeconds: 60, memoryMB: 1024,
  environment: { CHAT_MODEL_ID: 'qwen.qwen3-32b-v1:0', CHAT_PROVIDER: 'qwen' },
});
