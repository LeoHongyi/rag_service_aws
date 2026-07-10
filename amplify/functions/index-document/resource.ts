import { defineFunction } from '@aws-amplify/backend';

export const indexDocument = defineFunction({ name: 'index-document', entry: './handler.ts', timeoutSeconds: 120, memoryMB: 1024 });
