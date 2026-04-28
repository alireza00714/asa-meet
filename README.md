# ASA Meet Net

Anonymous meeting MVP with .NET Core 10 backend and React/TypeScript/Tailwind frontend.

## Privacy Guarantees

- No user accounts and no persistent database.
- Room, participant, waiting room, and chat state are in-memory with TTL.
- Ephemeral chat messages are hard-deleted by cleanup worker.
- Temporary files are intended to be TTL-expired and removed.

## Local Development

### Backend

```bash
cd backend/src/Api
dotnet run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Docker Deployment

```bash
./install.sh
```

The reverse proxy serves TLS on `443` and routes:
- `/` to frontend
- `/hubs/meeting` and `/healthz` to API

### Non-interactive/manual

```bash
cd deploy
docker compose --env-file .env up --build -d
```

## Operational Notes

- Configure TLS certs in `deploy/certs`.
- Keep operational logs short-lived and free of message content.
- For P2P scale (5-8 users), encourage camera off or reduced quality when needed.
