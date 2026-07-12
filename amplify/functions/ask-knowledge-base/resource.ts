import { defineFunction } from '@aws-amplify/backend';

export const askKnowledgeBase = defineFunction({
  name: 'ask-knowledge-base', entry: './handler.ts', timeoutSeconds: 60, memoryMB: 1024,
  resourceGroupName: 'data',
  environment: {
    LLM_PROVIDER: 'dashscope',
    CHAT_MODEL_ID: 'qwen-plus',
    EMBEDDING_MODEL_ID: 'text-embedding-v3',
    DASHSCOPE_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    DASHSCOPE_SECRET_ID: 'zhiwen/dashscope/api-key',
  },
});
