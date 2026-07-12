import { defineBackend } from '@aws-amplify/backend';
import { ArnFormat, Stack } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource.js';
import { indexDocument } from './functions/index-document/resource.js';
import { askKnowledgeBase } from './functions/ask-knowledge-base/resource.js';
import { application } from './functions/application/resource.js';

const backend = defineBackend({ auth, data, storage, indexDocument, askKnowledgeBase, application });
const dashscopeSecretArn = (resource: Parameters<typeof Stack.of>[0]) => Stack.of(resource).formatArn({
  service: 'secretsmanager',
  resource: 'secret',
  resourceName: 'zhiwen/dashscope/api-key-*',
  arnFormat: ArnFormat.COLON_RESOURCE_NAME,
});

const tables = backend.data.resources.tables;
for (const fn of [backend.indexDocument.resources.lambda, backend.askKnowledgeBase.resources.lambda]) {
  tables.KnowledgeBase.grantReadWriteData(fn);
  tables.Document.grantReadWriteData(fn);
  tables.KnowledgeChunk.grantReadWriteData(fn);
  fn.addToRolePolicy(new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:*::foundation-model/*'],
  }));
  fn.addToRolePolicy(new PolicyStatement({
    actions: ['secretsmanager:GetSecretValue'],
    resources: [dashscopeSecretArn(fn)],
  }));
}

backend.indexDocument.addEnvironment('KNOWLEDGE_BASE_TABLE', tables.KnowledgeBase.tableName);
backend.indexDocument.addEnvironment('DOCUMENT_TABLE', tables.Document.tableName);
backend.indexDocument.addEnvironment('CHUNK_TABLE', tables.KnowledgeChunk.tableName);
backend.askKnowledgeBase.addEnvironment('KNOWLEDGE_BASE_TABLE', tables.KnowledgeBase.tableName);
backend.askKnowledgeBase.addEnvironment('DOCUMENT_TABLE', tables.Document.tableName);
backend.askKnowledgeBase.addEnvironment('CHUNK_TABLE', tables.KnowledgeChunk.tableName);

for (const table of Object.values(tables)) table.grantReadWriteData(backend.application.resources.lambda);
backend.application.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['bedrock:InvokeModel'],
  resources: ['arn:aws:bedrock:*::foundation-model/*'],
}));
backend.application.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['secretsmanager:GetSecretValue'],
  resources: [dashscopeSecretArn(backend.application.resources.lambda)],
}));
for (const [key, table] of Object.entries(tables)) {
  backend.application.addEnvironment(`${key.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_TABLE`, table.tableName);
}
backend.storage.resources.bucket.grantReadWrite(backend.application.resources.lambda);
backend.application.addEnvironment('RAG_DOCUMENTS_BUCKET', backend.storage.resources.bucket.bucketName);
