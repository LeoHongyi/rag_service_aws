import { defineFunction } from '@aws-amplify/backend';

export const application = defineFunction({
  name: 'application-service', entry: './handler.ts', timeoutSeconds: 120, memoryMB: 1024,
  environment: {
    CHAT_MODEL_ID: 'qwen.qwen3-32b-v1:0',
    CHAT_PROVIDER: 'qwen',
    IMAGE_MODEL_ID: 'amazon.nova-canvas-v1:0',
  },
});
