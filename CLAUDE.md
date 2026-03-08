# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Style

Use comments sparingly. Only comment complex code.

## Commands

```bash
# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Development server (uses Turbopack)
npm run dev

# Build for production
npm run build

# Run tests (Vitest)
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Lint
npm run lint

# Reset the database
npm run db:reset

# Regenerate Prisma client after schema changes
npx prisma generate

# Run new migrations
npx prisma migrate dev
```

## Environment

Copy `.env` and set `ANTHROPIC_API_KEY`. Without it, the app uses a `MockLanguageModel` in `src/lib/provider.ts` that returns static pre-built components — useful for development without an API key.

## Architecture

UIGen is a Next.js 15 App Router app where users describe React components in a chat interface and see them rendered live in a sandboxed iframe.

### Core Data Flow

1. **User sends a message** → `ChatContext` (`src/lib/contexts/chat-context.tsx`) calls `/api/chat` via Vercel AI SDK's `useChat`, passing the serialized virtual file system and optional `projectId`.

2. **API route** (`src/app/api/chat/route.ts`) deserializes the file system, calls Claude with two tools (`str_replace_editor`, `file_manager`), streams the response, and on finish saves to the database if the user is authenticated.

3. **Tool calls stream back** → `ChatContext.onToolCall` delegates to `FileSystemContext.handleToolCall`, which updates the in-memory `VirtualFileSystem`.

4. **File system changes** → `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) increments `refreshTrigger`, which causes `PreviewFrame` to re-render.

5. **Preview** → `PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) calls `createImportMap` + `createPreviewHTML` from `src/lib/transform/jsx-transformer.ts`, which uses Babel standalone to transpile JSX/TSX files into blob URLs and injects them via an `<importmap>` script into a sandboxed iframe.

### Virtual File System

`VirtualFileSystem` (`src/lib/file-system.ts`) is an in-memory tree of `FileNode` objects. It is **never written to disk** during a session. It serializes to/from `Record<string, FileNode>` for storage in the database (`Project.data` column as JSON string) and for transport to the API route on each request.

### AI Tools

Two tools are registered with Claude in the chat API:
- **`str_replace_editor`** (`src/lib/tools/str-replace.ts`): Handles `create`, `view`, `str_replace`, and `insert` commands operating on `VirtualFileSystem`.
- **`file_manager`** (`src/lib/tools/file-manager.ts`): Handles `rename` and `delete` commands.

The system prompt is in `src/lib/prompts/generation.tsx`.

### Preview Rendering Pipeline

`src/lib/transform/jsx-transformer.ts` handles the browser-side rendering pipeline:
1. Transpiles each `.js/.jsx/.ts/.tsx` file with Babel standalone.
2. Creates blob URLs for each transpiled file.
3. Resolves `@/` path aliases, relative imports, and third-party packages (via `https://esm.sh/`).
4. Creates placeholder modules for missing imports to avoid crashes.
5. Injects everything into a full HTML document using an `<importmap>` and a module script that mounts the React app.
6. The preview auto-discovers the entry point looking for `/App.jsx`, `/App.tsx`, `/index.jsx`, `/index.tsx`, `/src/App.jsx`, `/src/App.tsx`.

### Authentication

JWT-based auth stored in an httpOnly cookie (`auth-token`). `src/lib/auth.ts` is server-only. Middleware (`src/middleware.ts`) protects `/api/projects` and `/api/filesystem` routes. The `/[projectId]` route redirects unauthenticated users to `/`.

Anonymous users can still use the app — their work is tracked in `sessionStorage` via `src/lib/anon-work-tracker.ts`.

### Database

Prisma with SQLite (`prisma/dev.db`). Reference `prisma/schema.prisma` anytime you need to understand the structure of data stored in the database. Two models:
- **`User`**: email + bcrypt password.
- **`Project`**: belongs to optional `User`. Stores `messages` (JSON array) and `data` (serialized `VirtualFileSystem` nodes) as string columns.

Prisma client is generated to `src/generated/prisma` (not the default location).

### Key Context Providers

`MainContent` (`src/app/main-content.tsx`) is the root client component that wraps the whole layout with `FileSystemProvider` → `ChatProvider`. The two providers are tightly coupled: `ChatProvider` reads `fileSystem` and `handleToolCall` from `FileSystemContext`.

### `node-compat.cjs`

All `next` scripts use `NODE_OPTIONS='--require ./node-compat.cjs'`. This shim patches Node.js globals needed by dependencies that assume a browser-like environment.
