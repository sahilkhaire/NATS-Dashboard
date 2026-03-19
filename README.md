# NATS Dashboard

A monitoring dashboard for NATS servers — connections, JetStream streams/consumers, cluster routes, and more. Supports both **standalone** and **cluster** NATS deployments with full visibility when using HTTP monitoring.

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
# Build and run
docker compose up -d

# Dashboard: http://localhost:3000
```

**Docker env vars** (set in `.env` or `docker compose`):

| Variable | Purpose | Example |
|----------|---------|---------|
| `NATS_URL` | NATS protocol (port 4222) | `nats://nats:4222` or `nats://host.docker.internal:4222` |
| `NATS_MONITORING_URL` | HTTP monitoring (port 8222). Auto-derived from NATS_URL if unset. | `http://nats:8222` when NATS is in another container |
| `NATS_TOKEN` | Auth token (if NATS uses token auth) | |

**NATS in another container:** Use the service name as host. Example `.env`:
```bash
NATS_URL=nats://nats:4222
NATS_MONITORING_URL=http://nats:8222
```
Then `docker compose up -d` (add NATS service to the same compose file, or use an external NATS network).

**NATS on host:** Use `host.docker.internal` (Mac/Windows) or host IP:
```bash
NATS_URL=nats://host.docker.internal:4222
# monitoringUrl auto-derived as http://host.docker.internal:8222
```
Ensure NATS has `-m 8222` or `http_port: 8222` in config.

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

### Standalone vs Cluster

The dashboard works with both deployment modes:

| Mode | What you see |
|------|--------------|
| **Standalone** | Single server. Cluster/Gateways/Leaf pages show empty states. Full server stats when using HTTP monitoring. |
| **Cluster** | Header shows "Cluster (N)". Cluster page lists route connections. Topology shows routes, remotes. |

**Full picture:** Add connections with `http://host:8222` (HTTP monitoring). Using `nats://host:4222` gives JetStream data but not connections, cluster routes, subscriptions, or CPU/memory.

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
