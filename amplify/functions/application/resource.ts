import { defineFunction } from '@aws-amplify/backend';

export const application = defineFunction({
  name: 'application-service', entry: './handler.ts', timeoutSeconds: 120, memoryMB: 1024,
  environment: {
    CHAT_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
    IMAGE_MODEL_ID: 'amazon.nova-canvas-v1:0',
  },
});
