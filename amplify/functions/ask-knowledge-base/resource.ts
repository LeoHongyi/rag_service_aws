import { defineFunction } from '@aws-amplify/backend';

export const askKnowledgeBase = defineFunction({ name: 'ask-knowledge-base', entry: './handler.ts', timeoutSeconds: 60, memoryMB: 1024 });
