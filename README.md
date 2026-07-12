# AWS Amplify RAG Service

This is an AWS Amplify Gen 2 full-stack migration of `AI小夕外挂RAG知识库版`. It includes Cognito authentication, chat data and RAG workflow, knowledge bases, document metadata and storage, model configuration, images, payment orders, support tickets, administrator authorization, and a React web console.

## Architecture

- **Amplify Auth / Cognito**: authenticated user access.
- **Amplify Data / AppSync / DynamoDB**: knowledge bases, documents, and chunks.
- **Amplify Storage / S3**: reserved for original-file uploads under `documents/{identityId}/`.
- **Lambda + DashScope**: Qwen chat and embedding-based document indexing and retrieval. Bedrock remains only for the optional Nova image workflow.
- **React + Amplify client**: chat, knowledge-base, file, order, and management workspace in `web/`.

The initial indexing mutation accepts `.txt` and `.md` content. File uploads are saved to S3 and recorded as attachments. Connect the selected file's extracted text to `indexDocument` for RAG indexing; `.docx` extraction requires a document-parser Lambda layer or provider because Lambda has no native DOCX parser.

## Prerequisites

1. Node.js 20 or newer and AWS credentials configured for the target account.
2. Create a DashScope API key and store it in AWS Secrets Manager as `zhiwen/dashscope/api-key`. Defaults:
   - Chat: `qwen-plus`
   - Embeddings: `text-embedding-v3`
3. Install dependencies with `npm install`.

## Deploy

For a development environment:

```bash
npm run sandbox
```

In a second terminal, start the React application:

```bash
npm run dev:web
```

The sandbox writes `amplify_outputs.json` into `web/public/`, so the Vite application automatically connects to the same Cognito, AppSync, S3, and Lambda resources.

For Amplify Hosting CI, connect this repository in the Amplify Console and set `AWS_APP_ID` and `AWS_BRANCH`. The committed `amplify.yml` deploys the backend and publishes the React application.

```bash
npm ci
npm run deploy
```

Chat and RAG indexing use DashScope's OpenAI-compatible API at `https://dashscope.aliyuncs.com/compatible-mode/v1`, which matches API keys created in Alibaba Cloud Model Studio (China). The functions retrieve `zhiwen/dashscope/api-key` at runtime, so never place the key in frontend configuration or Git. For an international Model Studio key, change `DASHSCOPE_BASE_URL` to `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`. Change `CHAT_MODEL_ID` and `EMBEDDING_MODEL_ID` in the function resource files to select another DashScope model. The Bedrock IAM permission remains for the optional Nova image workflow.

## API

Create a `KnowledgeBase` through the generated Amplify Data client. Then invoke:

```ts
await client.mutations.indexDocument({
  knowledgeBaseId,
  filename: 'handbook.md',
  content: markdown,
});

const response = await client.queries.askKnowledgeBase({
  knowledgeBaseId,
  question: '退款政策是什么？',
  topK: 5,
});
```

`response.data.sources` contains the document/chunk ids, excerpt, and similarity score needed to display citations.
