import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'ragDocuments',
  access: (allow) => ({
    'documents/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
    'generated/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
  }),
});
