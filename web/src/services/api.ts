import { generateClient } from 'aws-amplify/data';
import { confirmResetPassword, confirmSignUp, fetchAuthSession, getCurrentUser, resetPassword, signIn, signOut, signUp } from 'aws-amplify/auth';
import { downloadData, uploadData } from 'aws-amplify/storage';
import { queryClient, queryKeys } from './query-client';

const client = generateClient<any>();
const value = <T>(result: { data?: T; errors?: unknown }) => {
  if (result.errors) throw new Error(JSON.stringify(result.errors));
  return result.data as T;
};
const iso = (item: any) => ({ ...item, created_at: item.createdAt, updated_at: item.updatedAt });
const snakeBase = (item: any) => ({ ...iso(item), user_id: item.owner, is_public: item.isPublic ? 1 : 0, doc_count: item.documentCount ?? 0, chunk_count: item.chunkCount ?? 0 });
const snakeDocument = (item: any) => ({ ...iso(item), kb_id: item.knowledgeBaseId, file_type: item.fileType, file_size: item.size ?? 0, chunk_count: item.chunkCount ?? 0, error_msg: item.errorMessage, status: String(item.status ?? '').toLowerCase() });
const snakeMessage = (item: any) => ({ ...iso(item), conversation_id: item.conversationId, content_type: String(item.contentType ?? 'TEXT').toLowerCase(), reasoning_content: item.reasoningContent, model_used: item.modelUsed, rag_sources: item.ragSources });
const invalidate = (key: readonly unknown[]) => queryClient.invalidateQueries({ queryKey: key });

export default client;

export const authApi = {
  getSsoQr: async () => { throw new Error('SSO must be configured as a Cognito federation provider before use.'); },
  pollSso: async () => ({ status: 'pending' }),
  verifySsoToken: async () => {
    const session = await fetchAuthSession();
    return { token: session.tokens?.accessToken?.toString() };
  },
  getMe: async () => userApi.getProfile(),
  adminLogin: async (username: string, password: string) => {
    await signIn({ username, password });
    const session = await fetchAuthSession();
    return { token: session.tokens?.accessToken?.toString() };
  },
  localLogin: async (username: string, password: string) => {
    try {
      await signIn({ username, password });
    } catch (error: any) {
      if (error?.name !== 'UserAlreadyAuthenticatedException') throw error;
      const current = await getCurrentUser();
      if (current.username !== username) {
        await signOut();
        await signIn({ username, password });
      }
    }
    const session = await fetchAuthSession();
    return { accessToken: session.tokens?.accessToken?.toString(), user: await userApi.getProfile(), mustChangePassword: false };
  },
  register: async (email: string, password: string) => {
    const result = await signUp({ username: email, password, options: { userAttributes: { email } } });
    return { needsConfirmation: !result.isSignUpComplete };
  },
  confirmRegistration: async (email: string, code: string) => confirmSignUp({ username: email, confirmationCode: code }),
  beginPasswordReset: async (email: string) => resetPassword({ username: email }),
  confirmPasswordReset: async (email: string, code: string, password: string) => confirmResetPassword({ username: email, confirmationCode: code, newPassword: password }),
};

export const userApi = {
  getProfile: async () => {
    const user = await getCurrentUser();
    let profile = value<any>(await client.models.UserProfile.get({ id: user.userId }));
    if (!profile) profile = value<any>(await client.models.UserProfile.create({ id: user.userId, displayName: user.username, planType: 'FREE', tokenBalance: 100000, imagesUsed: 0, isDisabled: false }));
    const groups = (await fetchAuthSession()).tokens?.accessToken?.payload['cognito:groups'] as string[] | undefined;
    return { id: user.userId, openid: user.userId, nickname: profile?.displayName ?? user.username, avatar: profile?.avatarKey, plan_type: profile?.planType?.toLowerCase() ?? 'free', is_member: profile?.planType && profile.planType !== 'FREE' ? 1 : 0, tokens_remaining: profile?.tokenBalance ?? 100000, is_admin: groups?.includes('ADMIN') ? 1 : 0, images_used: profile?.imagesUsed ?? 0 };
  },
  getUsers: async (page = 1) => {
    const items = value<any[]>(await client.models.UserProfile.list()) ?? [];
    return { list: items.slice((page - 1) * 20, page * 20).map((item) => ({ ...item, id: item.id, nickname: item.displayName, plan_type: item.planType?.toLowerCase(), is_disabled: item.isDisabled ? 1 : 0 })), total: items.length };
  },
  updateUser: async (id: string | number, data: any) => value(await client.models.UserProfile.update({ id: String(id), displayName: data.nickname, planType: data.plan_type?.toUpperCase(), tokenBalance: data.tokens_remaining, isDisabled: typeof data.is_disabled === 'boolean' ? data.is_disabled : undefined })),
};

export const convApi = {
  list: async () => (value<any[]>(await client.models.Conversation.list()) ?? []).map((item) => ({ ...iso(item), user_id: item.owner, model_id: item.modelId, mode: String(item.mode ?? 'FAST').toLowerCase() })),
  create: async (data: any) => {
    const result = value<any>(await client.models.Conversation.create({ title: data.title ?? '新对话', modelId: data.model_id ? String(data.model_id) : undefined, mode: String(data.mode ?? 'fast').toUpperCase() }));
    invalidate(queryKeys.conversations); return { ...iso(result), user_id: result.owner, model_id: result.modelId, mode: String(result.mode).toLowerCase() };
  },
  update: async (id: string, data: any) => { const result = value<any>(await client.models.Conversation.update({ id, title: data.title, modelId: data.model_id ? String(data.model_id) : undefined, mode: data.mode?.toUpperCase() })); invalidate(queryKeys.conversations); return iso(result); },
  delete: async (id: string) => { value(await client.models.Conversation.delete({ id })); invalidate(queryKeys.conversations); },
  getMessages: async (id: string) => (value<any[]>(await client.models.ChatMessage.list({ filter: { conversationId: { eq: id } } })) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(snakeMessage),
};

export const modelApi = {
  list: async () => (value<any[]>(await client.models.ModelConfig.list({ filter: { enabled: { eq: true } } })) ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((item) => ({ ...iso(item), model_id: item.modelId, enabled: item.enabled ? 1 : 0, sort_order: item.sortOrder ?? 0 })),
  adminList: async () => modelApi.list(),
  create: async (data: any) => value(await client.models.ModelConfig.create({ name: data.name, provider: data.provider, modelId: data.model_id, baseUrl: data.base_url, enabled: data.enabled !== 0, sortOrder: data.sort_order ?? 0 })),
  update: async (id: string | number, data: any) => value(await client.models.ModelConfig.update({ id: String(id), name: data.name, provider: data.provider, modelId: data.model_id, baseUrl: data.base_url, enabled: data.enabled !== undefined ? Boolean(data.enabled) : undefined, sortOrder: data.sort_order })),
  delete: async (id: string | number) => value(await client.models.ModelConfig.delete({ id: String(id) })),
};

export const fileApi = {
  upload: async (file: File) => {
    const suffix = `${crypto.randomUUID()}-${file.name}`;
    const upload = await uploadData({ path: ({ identityId }) => `documents/${identityId}/${suffix}`, data: file }).result;
    return value<any>(await client.models.FileAttachment.create({ filename: file.name, storageKey: upload.path, mimeType: file.type, size: file.size }));
  },
  list: async () => (value<any[]>(await client.models.FileAttachment.list()) ?? []).map((item) => ({ ...iso(item), filepath: item.storageKey, mimetype: item.mimeType, size: item.size })),
  delete: async (id: string | number) => value(await client.models.FileAttachment.delete({ id: String(id) })),
  download: async (id: string | number, filename: string) => {
    const file = value<any>(await client.models.FileAttachment.get({ id: String(id) }));
    if (!file) throw new Error('文件不存在');
    const blob = await (await downloadData({ path: file.storageKey }).result).body.blob();
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
  },
};

export const imageApi = { generate: async (prompt: string, modelId?: string | number) => value<any>(await client.mutations.generateImage({ prompt, modelId: modelId ? String(modelId) : undefined })) };
export const payApi = {
  getPlans: async () => value<any[]>(await client.queries.paymentPlans()),
  createNative: async (plan: string) => value<any>(await client.mutations.createPayment({ planType: plan.toUpperCase(), channel: 'NATIVE' })),
  createJsapi: async (plan: string) => value<any>(await client.mutations.createPayment({ planType: plan.toUpperCase(), channel: 'JSAPI' })),
  queryStatus: async (orderNo: string) => (value<any[]>(await client.models.PaymentOrder.list({ filter: { orderNumber: { eq: orderNo } } })) ?? [])[0],
  getMyOrders: async () => value<any[]>(await client.models.PaymentOrder.list()),
  getAdminOrders: async () => ({ list: value<any[]>(await client.models.PaymentOrder.list()) ?? [] }),
};
export const ticketApi = {
  getAdminTickets: async () => ({ list: value<any[]>(await client.models.SupportTicket.list()) ?? [] }),
  updateTicket: async (id: string | number, data: any) => value(await client.models.SupportTicket.update({ id: String(id), status: data.status?.toUpperCase(), adminNotes: data.admin_notes })),
};

export const knowledgeApi = {
  listBases: async () => (value<any[]>(await client.models.KnowledgeBase.list()) ?? []).map(snakeBase),
  createBase: async (data: any) => snakeBase(value<any>(await client.models.KnowledgeBase.create({ name: data.name, description: data.description, isPublic: Boolean(data.is_public) }))),
  updateBase: async (id: string | number, data: any) => snakeBase(value<any>(await client.models.KnowledgeBase.update({ id: String(id), name: data.name, description: data.description, isPublic: data.is_public === undefined ? undefined : Boolean(data.is_public) }))),
  deleteBase: async (id: string | number) => value(await client.models.KnowledgeBase.delete({ id: String(id) })),
  listDocuments: async (kbId: string | number) => (value<any[]>(await client.models.Document.list({ filter: { knowledgeBaseId: { eq: String(kbId) } } })) ?? []).map(snakeDocument),
  getStatus: async (kbId: string | number) => { const documents = await knowledgeApi.listDocuments(kbId); return { total: documents.length, ready: documents.filter((item) => item.status === 'ready').length, indexing: documents.filter((item) => item.status === 'indexing').length, failed: documents.filter((item) => item.status === 'failed').length }; },
  uploadDocument: async (kbId: string | number, file: File) => { if (!/\.(txt|md)$/i.test(file.name)) throw new Error('Amplify 索引端点当前支持 .txt / .md。'); return value<any>(await client.mutations.indexDocument({ knowledgeBaseId: String(kbId), filename: file.name, content: await file.text() })); },
  deleteDocument: async (_kbId: string | number, docId: string | number) => value(await client.models.Document.delete({ id: String(docId) })),
  listChunks: async (_kbId: string | number, docId: string | number) => (value<any[]>(await client.models.KnowledgeChunk.list({ filter: { documentId: { eq: String(docId) } } })) ?? []).map((item) => ({ ...iso(item), chunk_index: item.chunkIndex, token_count: item.tokenCount })),
  getPreview: async (_kbId: string | number, docId: string | number) => { const chunks = await knowledgeApi.listChunks('', docId); return { id: String(docId), parsed_content: chunks.sort((a, b) => a.chunk_index - b.chunk_index).map((item) => item.content).join('\n\n') }; },
  getAnalytics: async () => { const bases = await knowledgeApi.listBases(); const documentLists = await Promise.all(bases.map((base) => knowledgeApi.listDocuments(base.id))); const documents = documentLists.flat(); return { overview: { totalBases: bases.length, publicBases: bases.filter((base) => base.is_public).length, privateBases: bases.filter((base) => !base.is_public).length, totalDocs: documents.length, totalChunks: documents.reduce((sum, item) => sum + (item.chunk_count ?? 0), 0) }, health: { byStatus: [], byType: [], successRate: documents.length ? Math.round(documents.filter((item) => item.status === 'ready').length / documents.length * 100) : 100, failedReasons: [] }, ragUsage: { totalAiMsgs: 0, ragMsgs: 0, hitRate: 0, trend: [] } }; },
};

export function streamChat(body: any, handlers: any): () => void {
  let aborted = false;
  client.mutations.completeChat({ conversationId: body.conversation_id, message: body.message, modelId: body.model_id ? String(body.model_id) : undefined, mode: body.mode, knowledgeBaseIds: body.kb_ids?.map(String), contentType: body.content_type?.toUpperCase() })
    .then((result: any) => { if (aborted) return; const data = value<any>(result); handlers.onSources?.(data.ragSources ?? []); handlers.onChunk(data.content); handlers.onDone?.({ fullText: data.content, reasoningText: data.reasoningContent, tokensUsed: data.tokensUsed, needsHuman: data.needsHuman }); invalidate(queryKeys.messages(body.conversation_id)); })
    .catch((error: Error) => !aborted && handlers.onError?.(error.message));
  return () => { aborted = true; };
}

export interface MultimodalPlan { summary: string; imageCount: number; chartCount: number; canGenerateImages: boolean; }
export function streamMultimodal(body: any, handlers: any): () => void {
  handlers.onPlan({ summary: '正在生成多模态内容', imageCount: 0, chartCount: 0, canGenerateImages: false });
  return streamChat({ ...body, content_type: 'MULTIMODAL' }, { onChunk: handlers.onChunk, onDone: handlers.onDone, onError: handlers.onError });
}
