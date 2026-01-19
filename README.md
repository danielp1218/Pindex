# Pindex <img src="/landing/public/logo.jpg" style="height: 38px; vertical-align: bottom; border-radius: 8px;">

> **Create your own agentic index funds inside Polymarket**

Agentic dependency analysis that reveals correlations between prediction markets. Analyze, decide, optimize—systematically.

https://github.com/user-attachments/assets/b8906aea-124f-4c83-a3a5-1d60837a4a47

---

## 🤩 Features

| Feature | Description |
|---------|-------------|
| **Dependency Discovery** | AI finds related markets that impact your positions |
| **Chain Visualization** | Interactive D3 graphs show market relationships |
| **Decision Support** | Accept or reject dependencies with impact analysis |
| **Portfolio Summary** | View all positions with allocation breakdown |
| **Floating Overlay** | Non-intrusive UI that lives on Polymarket pages |

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- Chrome browser (for extension)
- OpenAI API key
- Cloudflare account (for server deployment)

### Extension Setup

```bash
cd extension
npm install
```

**`.env` Configuration:**
```env
VITE_API_ENDPOINT=http://localhost:8787
```

**Run:**
```bash
npm run dev      # Development
npm run build    # Production build
```

Load from `extension/.output/chrome-mv3` in Chrome developer mode.

### Server Setup

```bash
cd server
npm install
npm run build:packages
```

**`.dev.vars` Configuration:**
```env
OPENAI_API_KEY=sk-your-openai-api-key
```

**Run:**
```bash
npm run dev      # Local (localhost:8787)
npm run deploy   # Deploy to Cloudflare
```

### Landing Setup

```bash
cd landing
npm install
npm run dev
```

---

## Usage

1. **Install Extension** - Load unpacked from `.output/chrome-mv3`
2. **Visit Polymarket** - Navigate to any event page
3. **Click Extension Icon** - Opens the Pindex overlay
4. **Start Analysis** - Click "Start Pindex" to find dependencies
5. **Review Dependencies** - Accept or reject related markets
6. **View Graph** - Visualize your dependency chain
7. **Check Summary** - Review portfolio allocation

---

## Tech Stack

| Component | Technologies |
|-----------|-------------|
| Extension | React, WXT, D3.js, Framer Motion |
| Server | Hono, Cloudflare Workers, OpenAI |
| Landing | Next.js, Tailwind CSS |
