# AWS Amplify RAG Service

This is an AWS Amplify Gen 2 full-stack migration of `AI小夕外挂RAG知识库版`. It includes Cognito authentication, chat data and RAG workflow, knowledge bases, document metadata and storage, model configuration, images, payment orders, support tickets, administrator authorization, and a React web console.

## Architecture

- **Amplify Auth / Cognito**: authenticated user access.
- **Amplify Data / AppSync / DynamoDB**: knowledge bases, documents, and chunks.
- **Amplify Storage / S3**: reserved for original-file uploads under `documents/{identityId}/`.
- **Lambda + Amazon Bedrock**: document indexing, retrieval-augmented answer generation, and application workflows.
- **React + Amplify client**: chat, knowledge-base, file, order, and management workspace in `web/`.

The initial indexing mutation accepts `.txt` and `.md` content. File uploads are saved to S3 and recorded as attachments. Connect the selected file's extracted text to `indexDocument` for RAG indexing; `.docx` extraction requires a document-parser Lambda layer or provider because Lambda has no native DOCX parser.

## Prerequisites

1. Node.js 20 or newer and AWS credentials configured for the target account.
2. Enable access to the configured Bedrock models in the target region. Defaults:
   - `amazon.titan-embed-text-v2:0`
   - `qwen.qwen3-32b-v1:0`
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

Chat uses the Bedrock Converse API, so Qwen and compatible DeepSeek models can share the same Lambda code. Change `CHAT_MODEL_ID` in both function resource files to a model ID available in the selected AWS Region before deployment. The Lambda role also needs `bedrock:InvokeModel` for the selected model ARN.

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
