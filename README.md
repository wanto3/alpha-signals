# Alpha Signals

High-conviction opportunities dashboard — aggregates crypto analysis, prediction markets, social signals, and on-chain data into simple decision indicators.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS
- **Backend:** Node.js, Express, TypeScript, SQLite (better-sqlite3)
- **Runtime:** tsx for TypeScript execution, concurrently for dev orchestration

## Getting Started

### Prerequisites

- Node.js 18+ (developed with Node 20)
- npm 9+

### Installation

Install all dependencies from the project root:

```bash
npm run install:all
```

This installs root dependencies and dependencies for both `client/` and `server/`.

### Database

SQLite database is initialized automatically on first server start. The database file is stored at `server/data/alpha_signals.db`.

To manually reinitialize:

```bash
npm run db:init
```

### Development

Start both frontend and backend with a single command from the project root:

```bash
npm run dev
```

This starts:
- **Frontend:** http://localhost:5173 (Vite dev server)
- **Backend:** http://localhost:3001 (Express API)

The Vite dev server proxies `/api` requests to the backend.

### Build

```bash
npm run build
```

Builds both client and server for production.

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/assets` | List all tracked assets |
| GET | `/api/assets/:id/prices` | Price history for an asset |
| GET | `/api/signals` | Recent signals |

### Database Schema

- **assets** — tracked symbols (BTC, ETH, SOL, etc.)
- **prices** — price history with 24h volume and change
- **signals** — AI-generated signals with conviction levels

## Project Structure

```
/
├── client/           # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── components/
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.js
├── server/           # Node.js + Express backend
│   ├── src/
│   │   ├── index.ts
│   │   ├── db/
│   │   │   ├── database.ts
│   │   │   └── init.ts
│   │   └── routes/
│   │       ├── health.ts
│   │       └── assets.ts
│   └── data/        # SQLite database (auto-created)
├── package.json     # Root with concurrently scripts
└── README.md
```

## Architecture Notes

- Server runs on port 3001, Vite proxies `/api` to avoid CORS in development
- SQLite with WAL mode for concurrent read access
- TypeScript strict mode enabled on both client and server
- Vite uses `moduleDetection: force` for optimal React fast refresh
