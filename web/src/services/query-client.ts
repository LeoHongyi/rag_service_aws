import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

export const queryKeys = {
  conversations: ['conversations'] as const,
  messages: (conversationId: string) => ['conversations', conversationId, 'messages'] as const,
  models: ['models'] as const,
  files: ['files'] as const,
  knowledgeBases: ['knowledge-bases'] as const,
  documents: (knowledgeBaseId: string | number) => ['knowledge-bases', knowledgeBaseId, 'documents'] as const,
  knowledgeAnalytics: ['knowledge-bases', 'analytics'] as const,
  paymentPlans: ['payment-plans'] as const,
  orders: ['orders'] as const,
  tickets: ['tickets'] as const,
  users: ['users'] as const,
};
