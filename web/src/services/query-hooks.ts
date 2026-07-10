import { useMutation, useQuery } from '@tanstack/react-query';
import { convApi, knowledgeApi, modelApi } from './api';
import { queryClient, queryKeys } from './query-client';

export function useConversations() {
  return useQuery({ queryKey: queryKeys.conversations, queryFn: () => convApi.list() });
}

export function useConversationMessages(conversationId?: string) {
  return useQuery({
    queryKey: queryKeys.messages(conversationId ?? ''),
    queryFn: () => convApi.getMessages(conversationId!),
    enabled: Boolean(conversationId),
  });
}

export function useKnowledgeBases() {
  return useQuery({ queryKey: queryKeys.knowledgeBases, queryFn: () => knowledgeApi.listBases() });
}

export function useKnowledgeDocuments(knowledgeBaseId?: string | number) {
  return useQuery({
    queryKey: queryKeys.documents(knowledgeBaseId ?? ''),
    queryFn: () => knowledgeApi.listDocuments(knowledgeBaseId!),
    enabled: knowledgeBaseId !== undefined,
  });
}

export function useModels() {
  return useQuery({ queryKey: queryKeys.models, queryFn: () => modelApi.list() });
}

export function useCreateConversation() {
  return useMutation({
    mutationFn: convApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
  });
}

export function useCreateKnowledgeBase() {
  return useMutation({
    mutationFn: knowledgeApi.createBase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBases }),
  });
}
