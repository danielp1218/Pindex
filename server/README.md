# Polyindex Server

Single-server stack for Polymarket indexing with LLM-powered market proposals.

## Stack

- **Hono** - Fast web framework
- **TypeScript** - Type safety
- **In-memory queue** - No Redis needed
- **SSE** - Real-time streaming
- **OpenAI** - Market proposal generation
- **Arize Phoenix** - LLM tracing & evaluation
- **Polymarket API** - Fetch markets

## Architecture

```
Client → Hono Server → OpenAI API
           ↓            Polymarket API
      In-Memory Queue
           ↓
    Background Agent Loop
           ↓
    SSE Broadcast → Clients
           ↓
    Arize Phoenix (Tracing)
```

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment:
```bash
cp .env.example .env
# Add your OPENAI_API_KEY
```

3. Run the server:
```bash
npm run dev
```

Server runs on `http://localhost:3000`

## API Endpoints

### Questions
- `POST /api/questions` - Submit a question for market proposal
- `GET /api/questions` - Get all questions
- `GET /api/questions/:id` - Get specific question

### Polymarket
- `GET /api/polymarket/markets` - Fetch all markets
- `GET /api/polymarket/search?q=<query>` - Search markets

### Streaming
- `GET /events` - SSE stream for real-time updates

### Health
- `GET /health` - Server health check

## Usage

### Submit a question:
```bash
curl -X POST http://localhost:3000/api/questions \
  -H "Content-Type: application/json" \
  -d '{"question": "Will AGI be achieved by 2030?"}'
```

### Connect to SSE stream:
```bash
curl -N http://localhost:3000/events
```

### Search Polymarket:
```bash
curl http://localhost:3000/api/polymarket/search?q=election
```

## How It Works

1. **Submit Question** - Client POSTs to `/api/questions`
2. **Queue** - Question added to in-memory queue
3. **Agent Loop** - Background process picks up pending questions
4. **LLM Generation** - OpenAI generates structured market proposal
5. **SSE Broadcast** - Result streamed to all connected clients
6. **Tracing** - All LLM calls traced in Arize Phoenix

## Development

Project structure:
```
src/
├── routes/                 # API route handlers
│   ├── health.ts          # Health check endpoint
│   ├── sse.ts             # SSE streaming endpoint
│   ├── questions.ts       # Question submission & retrieval
│   └── polymarket.ts      # Polymarket proxy routes
├── services/              # Business logic
│   ├── agent.ts           # Background processing loop
│   └── proposal-generator.ts  # Market proposal generation
├── lib/                   # External integrations
│   ├── openai.ts          # OpenAI client
│   ├── polymarket-api.ts  # Polymarket API client
│   └── phoenix.ts         # Arize Phoenix tracing
├── core/                  # Core infrastructure
│   ├── queue.ts           # In-memory question queue
│   └── sse.ts             # SSE broadcast utilities
├── types/                 # TypeScript definitions
│   └── index.ts           # Shared types
└── index.ts               # Main server entry point
```

## Environment Variables

```env
PORT=3000
OPENAI_API_KEY=sk-...
NODE_ENV=development
```

## Notes

**Polymarket API**: No API key needed - the CLOB API is public.

**Arize Phoenix**: Disabled by default due to package compatibility. The server works fine without it. You can add it later if needed for LLM observability.
