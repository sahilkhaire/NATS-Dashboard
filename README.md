# NATS Dashboard

A monitoring dashboard for NATS servers — connections, JetStream streams/consumers, cluster routes, and more.

## Quick Start

### Option 1: Local development (easiest)

```bash
# Install dependencies
npm install

# Start the dashboard (accessible at http://localhost:5173)
npm run dev
```

The dashboard connects to `http://localhost:8222` by default. Start NATS with monitoring enabled:

```bash
nats-server -m 8222 -js
```

### Option 2: Network access (other machines)

The dev server binds to `0.0.0.0`, so you can access it from other devices:

- **Your machine:** `http://localhost:5173`
- **Other machines:** `http://<your-ip>:5173`

Set `VITE_NATS_URL` to your NATS server URL (e.g. `http://192.168.1.10:8222`) if NATS runs elsewhere.

### Option 3: Docker

```bash
# Build and run with NATS
docker compose up -d

# Dashboard: http://localhost:80
# NATS monitoring: http://localhost:8222
```

### Option 4: Production build

```bash
npm run build
npm run start   # Serves on http://0.0.0.0:5173
```

Or use the Dockerfile for a static nginx deployment.

## Configuration

- **Connections (dropdown + plus):** Add and switch between connections. Saved connections are stored in `localStorage` and persist across refreshes.
- **Add Connection (+):** Add a connection with URL, optional token, and name. Useful when NATS context isn't available or the server is unreachable from context.
- **NATS Context:** If you use `nats context`, those appear in the connections dropdown alongside saved connections.
- **Settings (gear icon):** Change NATS URL, token, and poll interval. Manual URL overrides the selected connection.
- **Environment:** `VITE_NATS_URL` sets the default NATS monitoring URL (e.g. `http://nats:8222` in Docker)

### NATS Context integration

The dashboard integrates with the NATS CLI context (`nats context`):

- **Dev mode:** Contexts are read live from `~/.config/nats/context/` via a Vite plugin.
- **Production:** Run `npm run sync-context` before building to bake contexts into the app. Or run it after switching contexts to refresh.

## NATS Requirements

NATS must have the HTTP monitoring port enabled:

```bash
nats-server -m 8222
```

Or in config:

```yaml
http_port: 8222
```

## Pages

| Page | Data |
|------|------|
| Overview | Server stats, message rates, connections |
| Connections | Client connections, slow consumer alerts |
| JetStream | Memory, storage, streams, consumers |
| Streams | All streams with message counts |
| Consumers | Consumer lag (num_pending, num_ack_pending) |
| Subscriptions | Routing stats, fanout |
| Cluster | Route connections |
| Gateways | Supercluster gateways |
| Leaf Nodes | Leaf node connections |
| Accounts | Multi-account stats |
| Health | Health check status |
