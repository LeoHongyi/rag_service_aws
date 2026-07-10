import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { indexDocument } from '../functions/index-document/resource.js';
import { askKnowledgeBase } from '../functions/ask-knowledge-base/resource.js';
import { application } from '../functions/application/resource.js';

const schema = a.schema({
  KnowledgeBase: a.model({
    name: a.string().required(), description: a.string(), isPublic: a.boolean().default(false),
    documentCount: a.integer().default(0), chunkCount: a.integer().default(0),
  }).authorization((allow) => [allow.owner(), allow.authenticated().to(['read'])]),
  Document: a.model({
    knowledgeBaseId: a.id().required(), filename: a.string().required(), fileType: a.string().required(),
    status: a.enum(['INDEXING', 'READY', 'FAILED']), errorMessage: a.string(), chunkCount: a.integer().default(0),
  }).secondaryIndexes((index) => [index('knowledgeBaseId').sortKeys(['filename'])])
    .authorization((allow) => [allow.owner(), allow.authenticated().to(['read'])]),
  KnowledgeChunk: a.model({
    knowledgeBaseId: a.id().required(), documentId: a.id().required(), chunkIndex: a.integer().required(),
    content: a.string().required(), embedding: a.string().required(), tokenCount: a.integer().required(),
  }).secondaryIndexes((index) => [index('knowledgeBaseId').sortKeys(['documentId', 'chunkIndex'])])
    .authorization((allow) => [allow.owner(), allow.authenticated().to(['read'])]),
  UserProfile: a.model({
    displayName: a.string(), avatarKey: a.string(), planType: a.enum(['FREE', 'EXPERIENCE', 'SOURCE']),
    tokenBalance: a.integer().default(100000), imagesUsed: a.integer().default(0), isDisabled: a.boolean().default(false),
  }).authorization((allow) => [allow.owner(), allow.groups(['ADMIN'])]),
  Conversation: a.model({
    title: a.string().default('新对话'), modelId: a.id(), mode: a.enum(['FAST', 'THINKING']),
  }).authorization((allow) => [allow.owner(), allow.groups(['ADMIN']).to(['read'])]),
  ChatMessage: a.model({
    conversationId: a.id().required(), role: a.enum(['USER', 'ASSISTANT', 'SYSTEM']), content: a.string().required(),
    contentType: a.enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'FILE', 'MULTIMODAL']),
    reasoningContent: a.string(), modelUsed: a.string(), tokensUsed: a.integer().default(0), ragSources: a.json(), attachmentId: a.id(),
  }).secondaryIndexes((index) => [index('conversationId')])
    .authorization((allow) => [allow.owner(), allow.groups(['ADMIN']).to(['read'])]),
  ModelConfig: a.model({
    name: a.string().required(), provider: a.string().required(), modelId: a.string().required(), baseUrl: a.string(),
    supportsVision: a.boolean().default(false), supportsImageGeneration: a.boolean().default(false), supportsVoice: a.boolean().default(false),
    supportsVideo: a.boolean().default(false), enabled: a.boolean().default(true), sortOrder: a.integer().default(0),
  }).authorization((allow) => [allow.authenticated().to(['read']), allow.groups(['ADMIN'])]),
  FileAttachment: a.model({
    filename: a.string().required(), storageKey: a.string().required(), mimeType: a.string(), size: a.integer().default(0), parsedContent: a.string(),
  }).authorization((allow) => [allow.owner(), allow.groups(['ADMIN']).to(['read'])]),
  PaymentOrder: a.model({
    orderNumber: a.string().required(), providerOrderNumber: a.string(), amountCents: a.integer().required(),
    planType: a.enum(['EXPERIENCE', 'SOURCE']), status: a.enum(['PENDING', 'PAID', 'CLOSED', 'FAILED']), transactionId: a.string(),
  }).secondaryIndexes((index) => [index('orderNumber')])
    .authorization((allow) => [allow.owner(), allow.groups(['ADMIN']).to(['read'])]),
  SupportTicket: a.model({
    conversationId: a.id(), lastUserMessage: a.string(), emotion: a.string().default('neutral'), needsHuman: a.boolean().default(false),
    status: a.enum(['PENDING', 'HANDLING', 'RESOLVED', 'CLOSED']), adminNotes: a.string(),
  }).authorization((allow) => [allow.owner(), allow.groups(['ADMIN'])]),
  indexDocument: a.mutation().arguments({ knowledgeBaseId: a.id().required(), filename: a.string().required(), content: a.string().required() })
    .returns(a.ref('Document')).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(indexDocument)),
  askKnowledgeBase: a.query().arguments({ knowledgeBaseId: a.id().required(), question: a.string().required(), topK: a.integer() })
    .returns(a.customType({ answer: a.string().required(), sources: a.json().required() }))
    .authorization((allow) => [allow.authenticated()]).handler(a.handler.function(askKnowledgeBase)),
  completeChat: a.mutation().arguments({ conversationId: a.id().required(), message: a.string().required(), modelId: a.id(), mode: a.string(), knowledgeBaseIds: a.string().array(), contentType: a.string() })
    .returns(a.customType({ messageId: a.id().required(), content: a.string().required(), reasoningContent: a.string(), tokensUsed: a.integer().required(), ragSources: a.json().required(), needsHuman: a.boolean().required() }))
    .authorization((allow) => [allow.authenticated()]).handler(a.handler.function(application)),
  generateImage: a.mutation().arguments({ prompt: a.string().required(), modelId: a.id() })
    .returns(a.customType({ imageUrl: a.string().required(), imagesUsed: a.integer().required(), imageLimit: a.integer().required() }))
    .authorization((allow) => [allow.authenticated()]).handler(a.handler.function(application)),
  createPayment: a.mutation().arguments({ planType: a.string().required(), channel: a.string().required() })
    .returns(a.customType({ orderId: a.id().required(), orderNumber: a.string().required(), amountCents: a.integer().required(), paymentPayload: a.json().required() }))
    .authorization((allow) => [allow.authenticated()]).handler(a.handler.function(application)),
  paymentPlans: a.query().returns(a.json().required()).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(application)),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema, authorizationModes: { defaultAuthorizationMode: 'userPool' } });
