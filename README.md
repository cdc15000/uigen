# UIGen

## Overview

UIGen is a web app where you describe React components in a chat interface and see them rendered live in a sandboxed iframe. Powered by Claude, it generates and edits JSX/TSX files in an in-memory virtual file system with no build step required.

## Tech Stack

- **Next.js 15** with App Router
- **Turbopack** for fast development builds
- **Tailwind CSS** for styling
- **Lucide** for icons
- **Vitest** for unit testing

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy `.env` and set your `ANTHROPIC_API_KEY`:

```bash
cp .env.example .env
```

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
