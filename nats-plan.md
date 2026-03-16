# NATS Dashboard — Complete Master Plan for AI Code Generation
> **Who this is for:** Someone coming from RabbitMQ who wants full visibility into a NATS server — from raw message throughput all the way to JetStream consumer lag.

---

## TABLE OF CONTENTS
1. [What is NATS and How It Differs from RabbitMQ (Important Context)](#1-nats-vs-rabbitmq-context)
2. [How NATS Exposes Monitoring Data](#2-how-nats-exposes-monitoring-data)
3. [All NATS Monitoring HTTP Endpoints — Full Reference](#3-all-nats-monitoring-endpoints)
4. [Dashboard Architecture and Tech Stack](#4-dashboard-architecture)
5. [Dashboard Pages and Panels — Complete Specification](#5-dashboard-pages-and-panels)
6. [Data Fetching Strategy — Polling, Refresh, and Error Handling](#6-data-fetching-strategy)
7. [Visual Design Specification](#7-visual-design)
8. [Complete React Component Tree](#8-component-tree)
9. [Exact Code Instructions for AI](#9-code-instructions-for-ai)
10. [RabbitMQ → NATS Concept Mapping](#10-rabbitmq-to-nats-mapping)

---

## 1. NATS vs RabbitMQ Context

**Why this matters:** If you understand how NATS differs from RabbitMQ, you will understand why the dashboard is structured the way it is.

### Core NATS Messaging (a.k.a. "Core NATS" or "NATS Core")
- This is the basic pub/sub layer. It is like RabbitMQ fanout exchanges but fire-and-forget.
- There are NO queues, NO message persistence by default.
- Publishers send to a **subject** (think: topic string like `orders.created`).
- Subscribers listen on subjects, including wildcards like `orders.*` or `orders.>`.
- Messages are delivered only to currently connected subscribers. If no subscriber is listening, the message is DROPPED forever.
- This is very fast (millions of msgs/sec) because there is no storage overhead.

### JetStream (a.k.a. "JS")
- This is NATS's persistence/streaming layer, built on top of Core NATS.
- Think of it like Kafka or RabbitMQ Quorum Queues with TTLs, limits, and replication.
- **Streams** = storage buckets (like Kafka topics or RabbitMQ queue groups). A Stream captures messages published to one or more subjects and stores them on disk or in memory.
- **Consumers** = views into a Stream (like Kafka consumer groups or RabbitMQ subscriptions). A Consumer tracks which messages have been delivered and acknowledged.
- JetStream supports: push consumers (server pushes messages to client), pull consumers (client requests batches), durable (survives restarts), ephemeral (deleted when idle), acknowledgement policies, re-delivery on timeout, dead letter equivalents via advisories.

### Key Terms for the Dashboard
| NATS Term | RabbitMQ Equivalent | Dashboard Location |
|-----------|--------------------|--------------------|
| Subject | Routing Key / Exchange | Subscriptions page |
| Core NATS Subscription | Queue consumer (no ack) | Connections page |
| JetStream Stream | Queue (with persistence) | JetStream → Streams page |
| JetStream Consumer | Consumer Group / Subscription | JetStream → Consumers page |
| Cluster Route | Cluster node link | Cluster page |
| Leaf Node | Federated broker | Leaf Nodes page |
| Gateway | Shovel to another cluster | Gateway page |
| Account | Virtual Host (vhost) | Accounts page |
| Slow Consumer | Blocked consumer | Connections page (warning) |

---

## 2. How NATS Exposes Monitoring Data

### Enabling the Monitoring Port
NATS does NOT enable monitoring by default. It must be started with:
```
nats-server -m 8222
```
Or in the config file:
```
http_port: 8222
```

### How the HTTP Monitoring API Works
- All endpoints are simple HTTP GET requests.
- All responses are JSON.
- They are pull-based: you call them on a schedule (polling).
- Default port is **8222**.
- Base URL example: `http://localhost:8222`
- No authentication required (by design — keep it on internal network only).
- CORS is supported — you can call these from a browser directly.

### Polling Model (Important)
The dashboard must continuously poll these endpoints on a timer (e.g., every 2 seconds). This is the only way to get "live" data. There is no WebSocket or push model from the HTTP monitoring endpoints.

---

## 3. All NATS Monitoring Endpoints — Full Reference

This is the complete list of every HTTP endpoint the NATS server exposes. Each one is described with every field your dashboard should care about.

---

### 3.1 `/varz` — General Server Statistics

**URL:** `GET http://localhost:8222/varz`

**What it is:** The main health and throughput endpoint. Think of it as the "Overview" page in RabbitMQ management UI.

**Key Fields to Display:**

| Field | What It Means | Dashboard Widget |
|-------|---------------|-----------------|
| `server_id` | Unique ID of this server node | Header / info card |
| `server_name` | Human-readable server name | Header |
| `version` | NATS server version | Header |
| `go` | Go runtime version (internal, skip) | Tooltip only |
| `host` | Host/IP server is bound to | Info card |
| `port` | Client connection port (default 4222) | Info card |
| `max_connections` | Max allowed client connections | Gauge |
| `connections` | Current active connections | Big number + sparkline |
| `total_connections` | Total connections ever (cumulative) | Counter |
| `routes` | Number of cluster routes (other NATS servers in cluster) | Info card |
| `remotes` | Number of remote cluster servers | Info card |
| `leafnodes` | Number of leaf node connections | Info card |
| `in_msgs` | Total messages received since startup (cumulative) | Rate chart (calculate delta) |
| `out_msgs` | Total messages sent since startup (cumulative) | Rate chart (calculate delta) |
| `in_bytes` | Total bytes received since startup | Rate chart |
| `out_bytes` | Total bytes sent since startup | Rate chart |
| `slow_consumers` | Number of clients that are too slow to consume — CRITICAL | Alert badge, prominent warning |
| `subscriptions` | Total active subscriptions across all clients | Big number |
| `http_req_stats` | How many times each monitoring endpoint was called | Debug table |
| `mem` | Server memory usage in bytes | Memory gauge |
| `cores` | CPU cores available | Info |
| `cpu` | Current CPU usage percentage | CPU gauge |
| `uptime` | Human-readable uptime string | Info card |
| `start` | ISO timestamp of server start | Info card |
| `now` | Current server timestamp | Clock |
| `max_payload` | Max message payload size in bytes (default 1MB) | Info |
| `ping_interval` | Heartbeat interval in nanoseconds | Info |
| `auth_required` | Whether authentication is required | Security badge |
| `tls_required` | Whether TLS is required | Security badge |
| `cluster` | Object with cluster name and info | Link to cluster page |
| `jetstream` | Object with JetStream config (if enabled) | Link to JetStream page |

**How to calculate rates:**
Store the previous value of `in_msgs`. On next poll: `rate = (current_in_msgs - previous_in_msgs) / poll_interval_seconds`. Display as "msgs/sec".

---

### 3.2 `/connz` — Connection Details

**URL:** `GET http://localhost:8222/connz`

**Query Parameters:**
- `?limit=100` — Max connections to return (default 1024)
- `?offset=0` — Pagination offset
- `?sort=cid` — Sort by: `cid`, `start`, `subs`, `pending`, `msgs_to`, `msgs_from`, `bytes_to`, `bytes_from`, `last`, `idle`
- `?subs=1` — Include subscription list per connection
- `?state=open` — Filter by state: `open`, `closed`, `all`
- `?username=true` — Include username

**What it is:** Detailed info about every client currently connected. Like RabbitMQ's "Connections" tab.

**Top-level fields:**
| Field | Meaning |
|-------|---------|
| `num_connections` | Total connections returned |
| `total` | Total connections in server |
| `offset` | Pagination offset |
| `limit` | How many returned |
| `now` | Server timestamp |

**Per-connection fields (`connections[]` array):**

| Field | What It Means | Dashboard |
|-------|---------------|-----------|
| `cid` | Connection ID (unique integer) | Table row ID |
| `kind` | `Client`, `Router`, `Gateway`, `Leaf` | Badge/tag |
| `type` | Protocol type: `nats`, `mqtt`, `websocket` | Badge |
| `ip` | Client IP address | Table cell |
| `port` | Client port | Table cell |
| `name` | Optional name the client set on connect | Table cell |
| `lang` | Client library language (e.g., `go`, `node`, `python`) | Language badge |
| `version` | Client library version | Tooltip |
| `start` | When this connection was established | Table (relative time) |
| `last_activity` | Last time a message was sent/received | "Idle for X" |
| `rtt` | Round-trip time to client in string format (e.g., `1.2ms`) | Latency badge |
| `uptime` | How long this connection has been alive | Table |
| `idle` | How long since last activity | Warning if > threshold |
| `pending_bytes` | Bytes waiting to be sent to this client — HIGH = SLOW CONSUMER | Red warning if > 0 |
| `in_msgs` | Messages received from this client (cumulative) | Table |
| `out_msgs` | Messages sent to this client (cumulative) | Table |
| `in_bytes` | Bytes received from this client | Table |
| `out_bytes` | Bytes sent to this client | Table |
| `subscriptions` | Number of subscriptions this client has | Table |
| `subscriptions_list` | Array of subject strings (if `subs=1`) | Expandable row |
| `username` | Auth username (if `username=true`) | Table |
| `account` | Account this connection belongs to | Tag |

**Slow Consumer Detection:**
A slow consumer is a client whose `pending_bytes` keeps growing because the server is buffering data waiting for the client to read it. Display these at the top in a warning panel. In RabbitMQ, this is equivalent to a consumer with a growing unacknowledged message count.

---

### 3.3 `/routez` — Cluster Routes

**URL:** `GET http://localhost:8222/routez`

**Query Parameters:**
- `?subs=1` — Include subscriptions per route

**What it is:** In a NATS cluster, multiple nats-server processes form a cluster. Each server connects to others via "routes". This endpoint shows those inter-server connections. Like RabbitMQ cluster node list.

**Top-level:**
| Field | Meaning |
|-------|---------|
| `server_id` | This server's ID |
| `now` | Timestamp |
| `num_routes` | Number of cluster route connections |

**Per-route fields (`routes[]`):**
| Field | Meaning | Dashboard |
|-------|---------|-----------|
| `rid` | Route ID | Row |
| `remote_id` | Remote server's ID | Cell |
| `did_solicit` | Did this server initiate the connection? | Badge |
| `is_configured` | Is this a configured route (not auto-discovered)? | Badge |
| `ip` | Remote server IP | Cell |
| `port` | Remote server port | Cell |
| `import_subs` | Import subject restrictions | Tooltip |
| `export_subs` | Export subject restrictions | Tooltip |
| `pending_size` | Bytes pending on this route — high = congestion | Bar |
| `in_msgs` | Messages received from this peer | Counter |
| `out_msgs` | Messages sent to this peer | Counter |
| `in_bytes` | Bytes received | Counter |
| `out_bytes` | Bytes sent | Counter |
| `subscriptions` | Number of subscriptions on this route | Counter |

---

### 3.4 `/gatewayz` — Supercluster Gateways

**URL:** `GET http://localhost:8222/gatewayz`

**Query Parameters:**
- `?accs=true` — Include account information
- `?gw_name=name` — Filter by gateway name

**What it is:** When you connect multiple NATS clusters together into a "supercluster", servers communicate via gateways. Think of this like RabbitMQ Federation between separate clusters.

**Top-level:**
| Field | Meaning |
|-------|---------|
| `server_id` | This server |
| `now` | Timestamp |
| `name` | This gateway's name |
| `outbound_gateways` | Object: gateways this server connects OUT to |
| `inbound_gateways` | Object: gateways connecting IN to this server |

**Per-gateway fields (inside `outbound_gateways` and `inbound_gateways`):**
| Field | Meaning | Dashboard |
|-------|---------|-----------|
| `connection.name` | Name of the remote gateway cluster | Header |
| `connection.cid` | Connection ID | Row |
| `connection.ip` | Remote IP | Cell |
| `connection.port` | Remote port | Cell |
| `connection.rtt` | Latency to remote gateway | Latency indicator |
| `connection.in_msgs` | Messages received | Counter |
| `connection.out_msgs` | Messages sent | Counter |
| `connection.in_bytes` | Bytes received | Counter |
| `connection.out_bytes` | Bytes sent | Counter |
| `connection.pending_size` | Pending buffer | Warning if high |

---

### 3.5 `/leafz` — Leaf Node Connections

**URL:** `GET http://localhost:8222/leafz`

**Query Parameters:**
- `?subs=1` — Include subscriptions

**What it is:** Leaf nodes are lightweight NATS server instances that bridge to a hub cluster (like a remote office connecting to central datacenter). Think of it like a site-to-site connection in RabbitMQ federation.

**Top-level:**
| Field | Meaning |
|-------|---------|
| `num_leafs` | Number of leaf connections |

**Per-leaf fields (`leafs[]`):**
| Field | Meaning | Dashboard |
|-------|---------|-----------|
| `account` | Which account this leaf is on | Tag |
| `ip` | Leaf node IP | Cell |
| `port` | Leaf node port | Cell |
| `rtt` | Round-trip time to leaf | Latency |
| `in_msgs` | Messages received from leaf | Counter |
| `out_msgs` | Messages sent to leaf | Counter |
| `in_bytes` | Bytes received | Counter |
| `out_bytes` | Bytes sent | Counter |
| `subscriptions` | Number of subscriptions on leaf | Counter |
| `subscriptions_list` | List of subjects (if subs=1) | Expandable |

---

### 3.6 `/subsz` — Subscription Router Statistics

**URL:** `GET http://localhost:8222/subsz`

**Query Parameters:**
- `?subs=1` — Include actual subscription list
- `?limit=1024` — Number of results
- `?offset=0` — Pagination
- `?test=subject.name` — Test if a subscription matches

**What it is:** Statistics about the internal subscription routing engine (the "interest graph"). This is NATS's internal router that decides which connected client receives which message. Not normally used in daily ops but very useful for debugging.

**Fields:**
| Field | Meaning | Dashboard |
|-------|---------|-----------|
| `num_subscriptions` | Total active subscriptions | Big number |
| `num_cache` | Size of the subscription matching cache | Info |
| `num_inserts` | Total insertions into cache (cumulative) | Counter |
| `num_removes` | Total removals from cache (cumulative) | Counter |
| `num_matches` | Total subject matches done (cumulative) | Counter |
| `cache_hit_rate` | % of matches served from cache | Gauge (higher = better) |
| `max_fanout` | Max number of subscribers that received a single message | Big number |
| `avg_fanout` | Average fanout per message | Number |

**Fanout explained:** If 10 subscribers all subscribe to `orders.*` and a message comes in on `orders.created`, the fanout is 10. High fanout means one publisher is driving many consumers — normal for broadcast patterns, but could overwhelm slow consumers.

---

### 3.7 `/accountz` — Account Information

**URL:** `GET http://localhost:8222/accountz`

**Query Parameters:**
- `?acc=account_name` — Filter to specific account

**What it is:** NATS supports multiple isolated "accounts" — like RabbitMQ virtual hosts (vhosts). Each account has its own subjects, connections, and optionally JetStream. This endpoint shows all accounts and their usage.

**Top-level:**
| Field | Meaning |
|-------|---------|
| `server_id` | This server |
| `now` | Timestamp |
| `system_account` | The system account name ($SYS) |
| `accounts` | Array of account objects |

**Per-account fields:**
| Field | Meaning | Dashboard |
|-------|---------|-----------|
| `account_name` | Account identifier | Header |
| `update_time` | Last JWT update time | Info |
| `is_system` | Is this the system account? | Badge |
| `expired` | Has this account's JWT expired? | Alert |
| `complete` | Is account info complete? | Status |
| `jetstream_enabled` | Is JetStream enabled for this account? | Badge |
| `leafnode_connections` | Leaf nodes on this account | Counter |
| `client_connections` | Client connections on this account | Counter |
| `subscriptions` | Subscriptions on this account | Counter |
| `exports` | Subjects this account exports to others | Table |
| `imports` | Subjects this account imports from others | Table |

---

### 3.8 `/accstatz` — Account Statistics Summary

**URL:** `GET http://localhost:8222/accstatz`

**What it is:** A lightweight summary of statistics per account. Better for dashboards than the full `accountz` endpoint.

**Per-account stats:**
| Field | Meaning | Dashboard |
|-------|---------|-----------|
| `acc` | Account name | Row header |
| `conns` | Client connections | Counter |
| `leafnodes` | Leaf node connections | Counter |
| `total_conns` | conns + leafnodes | Counter |
| `num_subscriptions` | Total subscriptions | Counter |
| `sent.msgs` | Messages sent from this account | Rate chart |
| `sent.bytes` | Bytes sent | Rate chart |
| `received.msgs` | Messages received | Rate chart |
| `received.bytes` | Bytes received | Rate chart |
| `slow_consumers` | Slow consumers in this account | Alert badge |

---

### 3.9 `/jsz` — JetStream Summary

**URL:** `GET http://localhost:8222/jsz`

**Query Parameters:**
- `?accounts=true` — Include per-account JetStream breakdown
- `?streams=true` — Include stream list
- `?consumers=true` — Include consumers (requires streams=true)
- `?config=true` — Include stream/consumer config objects
- `?leader-only=true` — Only include data from the RAFT leader (use in clusters)
- `?limit=256` — Limit number of accounts returned
- `?offset=0` — Pagination offset

**What it is:** Everything about JetStream. This is the most important endpoint for persistence monitoring. Equivalent to monitoring all your queues, messages, and consumers in RabbitMQ but much richer.

**Top-level fields:**
| Field | Meaning | Dashboard |
|-------|---------|-----------|
| `server_id` | This server | Header |
| `now` | Timestamp | Clock |
| `config.max_memory` | Max memory JetStream can use | Gauge |
| `config.max_storage` | Max disk JetStream can use | Gauge |
| `config.store_dir` | Directory for JetStream storage | Info |
| `memory` | Current memory used by JetStream in bytes | Memory gauge |
| `storage` | Current disk used by JetStream in bytes | Disk gauge |
| `reserved_memory` | Reserved memory (allocated but may not be fully used) | Gauge |
| `reserved_storage` | Reserved disk space | Gauge |
| `accounts` | Number of accounts using JetStream | Counter |
| `ha_assets` | Number of HA (replicated) JetStream assets | Counter |
| `api.total` | Total JetStream API calls | Counter |
| `api.errors` | JetStream API errors — CRITICAL | Alert badge |
| `total_streams` | Total streams across all accounts | Big number |
| `total_consumers` | Total consumers across all accounts | Big number |
| `total_messages` | Total messages stored | Big number |
| `total_message_bytes` | Total bytes stored | Disk usage |
| `meta_cluster` | RAFT meta-cluster information (see below) | Cluster page |

**Meta-cluster fields (inside `meta_cluster`, for clustered JetStream):**
| Field | Meaning | Dashboard |
|-------|---------|-----------|
| `name` | Meta cluster name | Header |
| `leader` | Which server is the RAFT leader | Highlighted row |
| `peer` | Array of peers with their RAFT status | Table |
| `peer[].name` | Peer server name | Cell |
| `peer[].current` | Is this peer up-to-date? | Status badge |
| `peer[].active` | Last time heard from | Staleness warning |
| `peer[].lag` | How many RAFT log entries behind | RED alert if > 0 |
| `peer[].peer` | Peer ID | Cell |

---

### 3.10 `/jsz` — Per-Stream Fields (when `?streams=true`)

Each entry in the `account_details[].stream_detail[]` array:

| Field | Meaning | Dashboard |
|-------|---------|-----------|
| `name` | Stream name | Row header |
| `created` | When the stream was created | Info |
| `config.subjects` | Subjects this stream captures | Tag list |
| `config.retention` | Retention policy: `limits`, `interest`, `workqueue` | Badge |
| `config.storage` | `file` or `memory` | Badge |
| `config.replicas` | Replication factor (1=no replication, 3=3 copies) | Number badge |
| `config.max_msgs` | Max messages allowed | Limit bar |
| `config.max_bytes` | Max bytes allowed | Limit bar |
| `config.max_age` | Max message age (nanoseconds) | Info |
| `config.max_msg_size` | Max individual message size | Info |
| `config.discard` | `old` or `new` — what to do when full | Badge |
| `config.num_replicas` | Number of replicas | Info |
| `state.messages` | Current number of messages in stream | **KEY METRIC** — Big number |
| `state.bytes` | Current bytes stored in stream | Size display |
| `state.first_seq` | First (oldest) sequence number | Info |
| `state.last_seq` | Last (newest) sequence number | Info |
| `state.first_ts` | Timestamp of oldest message | Info |
| `state.last_ts` | Timestamp of newest message | Info |
| `state.num_subjects` | Number of distinct subjects with messages | Counter |
| `state.num_deleted` | Number of deleted messages | Info |
| `state.consumer_count` | Number of consumers on this stream | Counter |
| `cluster.name` | Cluster name | Info |
| `cluster.leader` | Which server holds the stream leader | Info |
| `cluster.replicas` | Array of replica status objects | Replica health table |

---

### 3.11 `/jsz` — Per-Consumer Fields (when `?consumers=true`)

Each consumer in `stream_detail[].consumer_detail[]`:

| Field | Meaning | Dashboard |
|-------|---------|-----------|
| `stream_name` | Parent stream name | Breadcrumb |
| `name` | Consumer name | Row header |
| `created` | Creation time | Info |
| `config.durable_name` | Durable name (empty = ephemeral) | Badge |
| `config.deliver_subject` | Push subject (empty = pull consumer) | Badge |
| `config.deliver_policy` | When to start: `all`, `last`, `new`, `by_start_sequence`, `by_start_time`, `last_per_subject` | Badge |
| `config.ack_policy` | Acknowledgement policy: `none`, `all`, `explicit` | Badge |
| `config.ack_wait` | How long to wait for ack before redelivery (nanoseconds) | Info |
| `config.max_deliver` | Max redelivery attempts before advisory | Info |
| `config.filter_subject` | Subject filter on this consumer | Tag |
| `config.replay_policy` | `instant` or `original` | Badge |
| `config.max_waiting` | Max pull requests waiting | Info |
| `config.max_ack_pending` | Max unacknowledged messages | Info |
| `delivered.consumer_seq` | Last sequence number delivered to consumer | Counter |
| `delivered.stream_seq` | Stream sequence of last delivered message | Counter |
| `ack_floor.consumer_seq` | Last acknowledged consumer sequence | Counter |
| `ack_floor.stream_seq` | Stream sequence of last acknowledged message | Counter |
| `num_ack_pending` | **Messages delivered but NOT yet acked — like unacked in RabbitMQ** | **RED if high** |
| `num_redelivered` | Messages redelivered due to ack timeout | Warning if > 0 |
| `num_waiting` | Pending pull requests (pull consumers only) | Counter |
| `num_pending` | **Messages in stream not yet delivered to this consumer — like queue depth** | **KEY METRIC** |
| `push_bound` | Is a push consumer currently bound to a subscriber? | Green/red status |
| `cluster.leader` | Which server leads this consumer | Info |

**The two most important consumer metrics:**
- `num_pending` = how far behind is this consumer (messages it hasn't received yet). This is your primary "queue depth" equivalent from RabbitMQ. A growing `num_pending` means the consumer is not keeping up.
- `num_ack_pending` = messages received but not yet acknowledged. Growing means the consumer receives messages but does not process and ack them fast enough.

---

### 3.12 `/healthz` — Health Check

**URL:** `GET http://localhost:8222/healthz`

**Query Parameters:**
- `?js-enabled=true` — Fail if JetStream is not enabled
- `?js-server-only=true` — Only check server, skip streams/consumers
- `?js-enabled-only=true` — Check only if JS is enabled

**Response:** Returns HTTP 200 `{"status":"ok"}` if healthy, or HTTP 503 with error details if not.

**Dashboard use:** Show a top-level health indicator (green/red) based on this endpoint. Poll it every 5 seconds.

---

### 3.13 `/stacksz` — Goroutine Stack Dump (Debug Only)

**URL:** `GET http://localhost:8222/stacksz`

Not normally shown in dashboard. Include as a "Debug" tab only for expert users.

---

## 4. Dashboard Architecture

### Technology Stack (Recommended for AI to Generate)

**Frontend Framework:** React (with hooks)
**Build Tool:** Vite (or Next.js)
**Styling:** Tailwind CSS
**Charts:** Recharts (for time-series line charts, bar charts)
**HTTP Client:** Fetch API (built into browser) or Axios
**State Management:** React useState + useEffect (no Redux needed for this scope)
**Routing:** React Router v6 (for multi-page navigation)

**Why React + Recharts:** Simple, well-documented, AI can generate it reliably. Recharts has LineChart, BarChart, AreaChart, PieChart all available.

### Architecture Diagram (in words)
```
App.jsx
├── Header.jsx                     (server name, health indicator, last updated time)
├── Sidebar.jsx                    (navigation between pages)
└── Pages/
    ├── OverviewPage.jsx            (uses /varz)
    ├── ConnectionsPage.jsx         (uses /connz)
    ├── JetStreamPage.jsx           (uses /jsz summary)
    ├── StreamsPage.jsx             (uses /jsz?streams=true)
    ├── StreamDetailPage.jsx        (uses /jsz?streams=true&consumers=true for one stream)
    ├── ConsumersPage.jsx           (uses /jsz?consumers=true)
    ├── SubscriptionsPage.jsx       (uses /subsz)
    ├── ClusterPage.jsx             (uses /routez + /jsz meta_cluster)
    ├── GatewayPage.jsx             (uses /gatewayz)
    ├── LeafNodesPage.jsx           (uses /leafz)
    ├── AccountsPage.jsx            (uses /accountz + /accstatz)
    └── HealthPage.jsx              (uses /healthz)
```

### Global State (Context or top-level state)
```javascript
const [serverUrl, setServerUrl] = useState('http://localhost:8222');
const [pollInterval, setPollInterval] = useState(2000); // ms
const [varzData, setVarzData] = useState(null);
const [history, setHistory] = useState([]); // rolling 60-point history for charts
```

### Polling Pattern (every page should use this)
```javascript
useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await fetch(`${serverUrl}/varz`);
      const json = await response.json();
      setData(json);
      setHistory(prev => [...prev.slice(-59), { time: Date.now(), value: json.in_msgs }]);
      setError(null);
    } catch (e) {
      setError('Cannot reach NATS server. Is monitoring port 8222 open?');
    }
  };
  fetchData(); // initial call
  const timer = setInterval(fetchData, pollInterval);
  return () => clearInterval(timer); // cleanup on unmount
}, [serverUrl, pollInterval]);
```

---

## 5. Dashboard Pages and Panels — Complete Specification

---

### PAGE 1: Overview (Home)

**Data source:** `/varz` polled every 2 seconds

**Top row — Health Summary Cards (4 cards):**
1. **Server Status** — Green "HEALTHY" or Red "UNREACHABLE" based on `/healthz`
2. **Uptime** — Human readable from `uptime` field (e.g., "3d 14h 22m")
3. **Version** — From `version` field (e.g., "2.10.5")
4. **JetStream** — "Enabled" or "Disabled" badge based on `/jsz` availability

**Second row — Live Traffic (2 charts side by side):**
1. **Messages/sec In** — Line chart. X=time (last 2 min), Y=msgs/sec. Calculated from delta of `in_msgs` between polls.
2. **Messages/sec Out** — Line chart. Same format for `out_msgs`.

**Third row — Key Counters (6 stat boxes):**
1. Active Connections (`connections`) with max (`max_connections`)
2. Total Subscriptions (`subscriptions`)
3. Slow Consumers (`slow_consumers`) — RED background if > 0
4. JetStream Total Streams (`total_streams` from /jsz)
5. JetStream Total Consumers (`total_consumers` from /jsz)
6. JetStream API Errors (`api.errors` from /jsz) — RED if > 0

**Fourth row — Throughput (2 charts):**
1. **Bytes/sec In** — Area chart for `in_bytes`
2. **Bytes/sec Out** — Area chart for `out_bytes`

**Fifth row — Server Resources (2 gauges + 1 info panel):**
1. **CPU Usage** — Circular gauge, value from `cpu`
2. **Memory Usage** — Bar gauge, value from `mem`, label shows "X MB / unlimited"
3. **Server Info** — Table: Server ID, Name, Host, Port, Go version, Cores

---

### PAGE 2: Connections

**Data source:** `/connz?subs=1&state=open&limit=1000` polled every 3 seconds

**Top — Slow Consumer Alert Banner:**
- Only shown if any connection has `pending_bytes > 0`
- Lists the slow consumers with their IP, pending bytes, and client name
- Styled in red/orange

**Filter Bar:**
- Search by IP, name, username, account (client-side filter)
- Sort dropdown: by pending_bytes, in_msgs, out_msgs, subscriptions, uptime
- Filter by kind: All, Client, Router, Gateway, Leaf
- Filter by language: All, Go, Node, Python, Java, etc.

**Connections Table (sortable):**

| Column | Value | Notes |
|--------|-------|-------|
| ID | `cid` | |
| Name | `name` | Empty if not set |
| IP:Port | `ip:port` | Clickable |
| Kind | `kind` | Badge |
| Language | `lang` | Icon badge |
| Uptime | `uptime` | |
| Idle | `idle` | Orange if > 30s, red if > 5min |
| RTT | `rtt` | Color-coded: green < 1ms, yellow < 10ms, red > 10ms |
| Pending | `pending_bytes` | Red if > 0, formatted as KB/MB |
| Msgs In | `in_msgs` | Formatted with commas |
| Msgs Out | `out_msgs` | |
| Subs | `subscriptions` | |
| Account | `account` | |

**Expandable Row Detail:**
When a row is clicked, expand to show:
- Full subscription list (`subscriptions_list`)
- Raw JSON (for debugging)

---

### PAGE 3: JetStream Overview

**Data source:** `/jsz?accounts=true` polled every 3 seconds

**Top Row — JetStream Health Indicators (4 cards):**
1. **Total Memory Used** — progress bar vs `config.max_memory`
2. **Total Disk Used** — progress bar vs `config.max_storage`
3. **API Calls Total** — `api.total` counter
4. **API Errors** — `api.errors` — RED if > 0

**Second Row — Counts (4 big numbers):**
1. Total Streams
2. Total Consumers
3. Total Messages Stored
4. Total Bytes Stored

**Third Row — Meta Cluster Status (if clustered):**
- Table of RAFT peers: Name, Leader (yes/no), Current (synced?), Active (last heartbeat), Lag
- Lag > 0 highlighted in red — means that server is behind on JetStream writes

**Fourth Row — Per-Account JetStream Table:**
| Account | Streams | Consumers | Messages | Bytes | Memory | Storage |
| --- | --- | --- | --- | --- | --- | --- |

---

### PAGE 4: Streams

**Data source:** `/jsz?accounts=true&streams=true` polled every 5 seconds

**Filter Bar:**
- Search by stream name
- Filter by retention policy (limits / interest / workqueue)
- Filter by storage type (file / memory)

**Streams Table (sortable):**

| Column | Value |
|--------|-------|
| Name | `name` |
| Subjects | `config.subjects` (tag pills) |
| Retention | `config.retention` (badge) |
| Storage | `config.storage` (file/memory icon) |
| Replicas | `config.replicas` (number badge, red if 1 and cluster active) |
| Messages | `state.messages` (big, highlighted) |
| Bytes | `state.bytes` (human readable) |
| Consumers | `state.consumer_count` |
| First Msg | `state.first_ts` (relative time) |
| Last Msg | `state.last_ts` (relative time) |
| Limit | Messages vs `config.max_msgs` (mini progress bar) |
| Cluster Leader | `cluster.leader` |

**Click on a stream → Stream Detail Page (see PAGE 5)**

---

### PAGE 5: Stream Detail

**Data source:** `/jsz?accounts=true&streams=true&consumers=true` — filtered to one stream

**Stream Info Panel:**
- Name, created time, subjects, config summary

**Storage Gauge:**
- Current bytes vs max bytes
- Current messages vs max messages

**Replica Health Table:**
- Per-replica: server name, current (synced?), active (last heartbeat), lag, peer

**Consumers Table:**

| Column | Value | Warning |
|--------|-------|---------|
| Name | `name` | |
| Type | Push/Pull, Durable/Ephemeral | |
| Deliver Policy | `config.deliver_policy` | |
| Ack Policy | `config.ack_policy` | |
| Filter | `config.filter_subject` | |
| Num Pending | `num_pending` | RED if > 1000 |
| Ack Pending | `num_ack_pending` | RED if > 0 |
| Redelivered | `num_redelivered` | Orange if > 0 |
| Waiting | `num_waiting` | For pull consumers |
| Push Bound | `push_bound` | Red if push consumer and not bound |
| Leader | `cluster.leader` | |

**num_pending explained inline on the page:**
> "num_pending = messages in this stream that this consumer has NOT yet received. Think of it like your queue depth in RabbitMQ. If this number is growing, your consumer is slower than your producer."

---

### PAGE 6: All Consumers

**Data source:** `/jsz?accounts=true&streams=true&consumers=true` polled every 3 seconds

**Top Alert Panel:**
- Lists consumers where `num_pending > 1000` or `num_ack_pending > 0` or `num_redelivered > 0`
- Sorted by severity

**Filter Bar:**
- Search by consumer name
- Filter by stream
- Filter by type: pull/push, durable/ephemeral
- Filter by ack policy

**Consumers Table:** (same columns as PAGE 5 consumers table but across all streams)

**Consumer Lag Chart:**
- Bar chart showing `num_pending` per consumer side by side
- This immediately shows which consumer is falling behind

---

### PAGE 7: Subscriptions

**Data source:** `/subsz?subs=1` polled every 5 seconds

**Statistics Row (4 cards):**
1. Total Subscriptions (`num_subscriptions`)
2. Cache Hit Rate (`cache_hit_rate`) — formatted as percentage
3. Max Fanout (`max_fanout`) — how many clients got the same message at once
4. Avg Fanout (`avg_fanout`)

**Subscription Routing Info:**
- Table showing subscription counts
- Cache stats: inserts, removes, matches

**What Fanout means (in-page explanation):**
> "Fanout is how many subscribers receive a single published message. A fanout of 1 means point-to-point delivery. A fanout of 100 means one publisher triggers 100 subscribers. High fanout with slow subscribers creates slow consumer problems."

---

### PAGE 8: Cluster

**Data source:** `/routez?subs=1` + JetStream meta_cluster from `/jsz`

**Cluster Topology Visualization:**
- A simple node diagram: show each server as a box, draw lines for routes
- Use SVG or simple CSS grid layout
- Show the local server differently (highlighted border)

**Routes Table:**
| Column | Value | Warning |
|--------|-------|---------|
| Remote ID | `remote_id` | |
| IP:Port | `ip:port` | |
| Initiated By | `did_solicit` | |
| Configured | `is_configured` | |
| RTT | (if available) | |
| Pending | `pending_size` | Red if > 0 |
| Msgs In | `in_msgs` (rate) | |
| Msgs Out | `out_msgs` (rate) | |
| Subscriptions | `subscriptions` | |

**JetStream RAFT Meta-Cluster:**
(same as JetStream Overview page RAFT panel)

---

### PAGE 9: Gateways

**Data source:** `/gatewayz?accs=true`

**Gateway Topology:**
- Show this server's gateway name
- Show outbound connections (we connect TO them)
- Show inbound connections (they connect TO us)

**Outbound Gateways Table:**
| Gateway Name | IP | Port | RTT | Msgs In | Msgs Out | Pending |
| --- | --- | --- | --- | --- | --- | --- |

**Inbound Gateways Table:**
Same columns as outbound.

**Explanation panel on page:**
> "Gateways link separate NATS clusters into a supercluster. This is different from cluster routes. Routes connect servers in the SAME cluster. Gateways connect DIFFERENT clusters across data centers or networks. Think of it like a WAN link between two separate RabbitMQ clusters."

---

### PAGE 10: Leaf Nodes

**Data source:** `/leafz?subs=1`

**Summary Card:**
- Total leaf nodes connected

**Leaf Nodes Table:**
| Account | IP | Port | RTT | Msgs In | Msgs Out | Bytes In | Bytes Out | Subscriptions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

**Expandable:** Click to show subscription list

**Explanation panel:**
> "Leaf nodes are lightweight NATS servers (or clients) that bridge to this hub server. They are typically used for edge computing, remote offices, or IoT devices. The leaf node sees a subset of the hub's subjects. Unlike cluster routes, a leaf node does not need to be a full cluster member."

---

### PAGE 11: Accounts

**Data source:** `/accountz` + `/accstatz` polled every 5 seconds

**Accounts Table:**
| Account | Clients | Leafnodes | Subs | Msgs Sent | Msgs Recv | Slow Consumers | JetStream |
| --- | --- | --- | --- | --- | --- | --- | --- |

**Account Detail (expandable):**
- Imports table (subjects imported from other accounts)
- Exports table (subjects this account shares)
- JWT expiry warning if `expired: true`

**JetStream Per-Account Section:**
- Memory usage, storage usage, stream count, consumer count

**Explanation panel:**
> "Accounts in NATS are like Virtual Hosts in RabbitMQ. They provide isolation — subjects in account A are invisible to clients in account B by default. Exports/Imports let accounts selectively share subjects with each other, like a controlled message bridge."

---

### PAGE 12: Health Check

**Data source:** `/healthz` polled every 5 seconds

**Top:** Large colored status indicator (GREEN = OK, RED = Error)

**Health Check Options:**
- Toggle buttons for query parameters
- Check: JetStream enabled
- Check: Streams/consumers health
- Shows the raw response for transparency

**Historical Health Log:**
- Simple list of last 20 health check results with timestamps

---

## 6. Data Fetching Strategy

### Polling Intervals (Recommended)
| Endpoint | Interval | Reason |
|----------|----------|--------|
| `/healthz` | 5 seconds | Lightweight, critical |
| `/varz` | 2 seconds | Main stats, fast |
| `/connz` | 3 seconds | Heavier, less urgent |
| `/jsz` (summary) | 3 seconds | JetStream health |
| `/jsz?streams=true` | 5 seconds | Heavier query |
| `/jsz?consumers=true` | 5 seconds | Heaviest query |
| `/routez` | 5 seconds | Cluster rarely changes |
| `/gatewayz` | 10 seconds | Very rarely changes |
| `/leafz` | 5 seconds | Moderate |
| `/accountz` | 10 seconds | Rarely changes |
| `/subsz` | 5 seconds | Moderate |

### Rate Calculation
For any cumulative counter (like `in_msgs`, `in_bytes`), calculate the per-second rate like this:
```javascript
// In your state, keep previous values:
const [prevStats, setPrevStats] = useState({ in_msgs: 0, timestamp: Date.now() });

// After each fetch:
const now = Date.now();
const elapsed = (now - prevStats.timestamp) / 1000; // convert ms to seconds
const rate = (newData.in_msgs - prevStats.in_msgs) / elapsed;

// Store rounded rate
const msgsPerSec = Math.round(rate);

// Update previous
setPrevStats({ in_msgs: newData.in_msgs, timestamp: now });
```

### Rolling History for Charts
```javascript
// Keep last 60 data points (at 2s interval = 2 minutes of history)
const MAX_HISTORY = 60;

const addToHistory = (prev, newPoint) => {
  const updated = [...prev, newPoint];
  return updated.slice(-MAX_HISTORY);
};
```

### Error Handling
- If a fetch fails, show a warning banner: "Cannot reach NATS server at [URL]. Check monitoring port."
- Keep showing the last known data with a stale indicator ("Last updated: 15s ago")
- Provide a "Configure Server URL" button to change the endpoint

### CORS Considerations
NATS monitoring endpoints support CORS. However, if your dashboard is served from a different origin, some browsers may block the request. Solutions:
1. Serve the dashboard HTML from the same server as NATS (easiest)
2. Use a thin proxy (nginx) that forwards `/api/*` to `localhost:8222`
3. Use a browser extension that disables CORS (dev only)

---

## 7. Visual Design Specification

### Color System
```css
/* Dark theme (recommended for monitoring dashboards) */
--bg-primary: #0f1117;        /* Main background */
--bg-secondary: #1a1d27;      /* Card background */
--bg-tertiary: #242736;       /* Table row hover */
--border: #2d3148;            /* Card borders */
--text-primary: #e8eaf6;      /* Primary text */
--text-secondary: #8b92b3;    /* Secondary text */
--text-muted: #4d5278;        /* Muted text */

/* Accent — NATS brand uses teal/blue */
--accent-primary: #00c8b4;    /* Teal (from NATS brand) */
--accent-secondary: #4d8ff5;  /* Blue */

/* Status colors */
--status-ok: #00d4a1;         /* Green */
--status-warn: #f5a623;       /* Orange */
--status-error: #ff4d6d;      /* Red */
--status-info: #4d8ff5;       /* Blue */

/* Chart colors */
--chart-1: #00c8b4;           /* Teal (in msgs) */
--chart-2: #4d8ff5;           /* Blue (out msgs) */
--chart-3: #f5a623;           /* Orange (warnings) */
--chart-4: #a78bfa;           /* Purple (secondary) */
```

### Typography
- **Dashboard header:** Monospace font (JetBrains Mono or Fira Code) — gives technical feel
- **Numbers/metrics:** Tabular font with fixed-width digits
- **Labels:** Clean sans-serif (e.g., Inter or DM Sans)

### Layout
- **Sidebar:** Fixed left sidebar, 240px wide, collapsible
- **Main content:** Fluid, max-width 1600px
- **Cards:** Rounded corners (8px), subtle border, drop shadow
- **Tables:** Striped rows, hover highlight, sticky header on scroll

### Alert / Warning Patterns
- **Critical (red):** Full-width banner at top of page, with icon and description
- **Warning (orange):** Inline badge on the affected metric
- **Info (blue):** Subtle highlight row in tables

### Icons
Use a consistent icon library (Lucide React is recommended — it's lightweight and has NATS-relevant icons):
- Server: `Server` icon
- Connections: `Users` icon
- Streams: `Database` icon
- Consumers: `Download` icon
- Cluster: `GitMerge` icon
- Gateway: `Globe` icon
- Leaf: `Leaf` icon
- Health: `Heart` icon

---

## 8. Component Tree

```
App.jsx
├── ConfigContext.jsx          (serverUrl, pollInterval — React Context)
├── DataContext.jsx            (shared /varz data — React Context)
│
├── Header.jsx
│   ├── ServerHealthBadge.jsx  (calls /healthz)
│   ├── ServerNameDisplay.jsx  (from /varz)
│   └── LastUpdated.jsx        (shows "Updated 2s ago")
│
├── Sidebar.jsx
│   └── NavItem.jsx (repeated per page)
│
└── MainContent.jsx
    └── [active page component]

Shared Components:
├── MetricCard.jsx             (big number + label + optional trend arrow)
├── SparklineChart.jsx         (Recharts LineChart, small, no axes)
├── AreaChart.jsx              (Recharts AreaChart, with axes and time)
├── BarChart.jsx               (Recharts BarChart, for comparisons)
├── StatusBadge.jsx            (colored pill: green/orange/red)
├── DataTable.jsx              (sortable, filterable, paginated table)
├── ExpandableRow.jsx          (click to show JSON detail)
├── GaugeBar.jsx               (horizontal progress bar with limits)
├── AlertBanner.jsx            (full-width warning/error display)
├── FilterBar.jsx              (search + filter dropdowns)
├── LoadingSpinner.jsx
├── ErrorState.jsx
└── ByteFormatter.jsx          (utility: converts 1048576 → "1.0 MB")

Page Components:
├── OverviewPage.jsx
├── ConnectionsPage.jsx
├── JetStreamOverviewPage.jsx
├── StreamsPage.jsx
├── StreamDetailPage.jsx       (receives streamName as prop/param)
├── ConsumersPage.jsx
├── SubscriptionsPage.jsx
├── ClusterPage.jsx
├── GatewayPage.jsx
├── LeafNodesPage.jsx
├── AccountsPage.jsx
└── HealthPage.jsx
```

---

## 9. Exact Code Instructions for AI

When feeding this document to an AI to generate the dashboard, use these instructions exactly:

### Instruction Template
```
You are building a NATS monitoring dashboard as a single-page React app using Vite, 
React 18, Tailwind CSS, Recharts, React Router v6, and Lucide React icons.

The dashboard connects to a NATS server's HTTP monitoring API (default: http://localhost:8222).

---

BUILD THIS IN ORDER:

STEP 1 — Create the app shell:
- App.jsx with React Router
- Sidebar with navigation links to all 12 pages
- Header with server health badge and last-updated timestamp
- A "Settings" modal to configure server URL and poll interval
- Use dark theme CSS variables as defined in the design spec

STEP 2 — Create shared utility components:
- MetricCard (big number + label + optional sparkline)
- DataTable (sortable, searchable, paginated)
- StatusBadge (green/orange/red pill)
- AlertBanner (for slow consumers and errors)
- GaugeBar (progress bar with min/max/current)
- ByteFormatter utility function
- RateCalculator hook (calculates per-second rate from cumulative counters)
- usePolling hook (generic hook that fetches a URL on interval)

STEP 3 — Build OverviewPage using /varz:
[full description as in Section 5, PAGE 1]

STEP 4 — Build ConnectionsPage using /connz:
[full description as in Section 5, PAGE 2]

STEP 5 — Build JetStreamOverviewPage using /jsz:
[...]

Continue building each page in order.

---

KEY REQUIREMENTS:
1. Never use localStorage or sessionStorage (not supported in Claude.ai artifacts)
2. Use React state (useState, useReducer) for all data storage
3. Every fetch must handle errors gracefully — show last known data + stale indicator
4. Calculate message/byte rates from cumulative counters using previous value + elapsed time
5. Keep rolling 60-point history arrays for time series charts
6. Use polling (setInterval) — NOT WebSocket — for data updates
7. Default NATS monitoring URL: http://localhost:8222
8. All endpoints return JSON — use fetch() and response.json()
9. Use Recharts for all charts (LineChart, AreaChart, BarChart)
10. Color theme: dark background #0f1117, teal accent #00c8b4, red alerts #ff4d6d

---

NATS-SPECIFIC NOTES FOR AI:
- "slow_consumers" in /varz is CRITICAL — show prominently in red
- "num_pending" in consumer data = queue depth (RabbitMQ equivalent)
- "num_ack_pending" = unacknowledged messages
- "num_redelivered" = retry count (messages that timed out and were sent again)
- JetStream must be enabled on the server for /jsz to return real data
- For clusters, always add ?leader-only=true to /jsz to avoid duplicates
- Routes (/routez) are intra-cluster. Gateways (/gatewayz) are inter-cluster.
```

---

## 10. RabbitMQ → NATS Concept Mapping

(Include this as an info panel somewhere in the dashboard for user learning)

| RabbitMQ Concept | NATS Equivalent | Where in Dashboard |
|------------------|-----------------|-------------------|
| Overview page | Overview page (`/varz`) | Overview |
| Connections tab | Connections page (`/connz`) | Connections |
| Queue (basic) | Core NATS subscription | Subscriptions page |
| Queue (persistent) | JetStream Stream | Streams page |
| Consumer (subscription) | JetStream Consumer | Consumers page |
| Consumer group | JetStream Consumer (pull, shared) | Consumers page |
| Message depth / queue depth | `num_pending` on consumer | Consumers page |
| Unacked messages | `num_ack_pending` on consumer | Consumers page |
| Dead letter exchange | `$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.*` | Advisories (advanced) |
| Bindings | Subject filters on JetStream Consumer | Stream Detail page |
| Exchange (fanout) | Core NATS publish to wildcard | Subscriptions page |
| Exchange (direct) | Exact subject match | Subscriptions page |
| Exchange (topic) | NATS wildcard subject (`orders.*`, `orders.>`) | Subscriptions page |
| Vhost | Account | Accounts page |
| Federation | Leaf Node or Gateway | Leaf Nodes / Gateway page |
| Cluster | NATS Cluster + Routes | Cluster page |
| Memory alarms | `mem` in `/varz` + JetStream `memory` | Overview |
| Flow control / backpressure | `slow_consumers` + `pending_bytes` | Connections page (warning) |
| Policy (TTL, max-length) | Stream config: `max_age`, `max_msgs`, `max_bytes` | Stream Detail |
| Shovel | Leaf Node or Gateway | Leaf Nodes / Gateway page |
| `rabbitmqctl` | `nats` CLI tool | (external, link in dashboard) |

---

## APPENDIX A: Full Endpoint URL Reference

```
Base URL: http://<nats-server-host>:8222

GET /                          → NATS home/info page
GET /varz                      → General server stats
GET /connz                     → Client connections
GET /connz?limit=100           → First 100 connections
GET /connz?offset=100          → Connections 101-200
GET /connz?subs=1              → Include subscription lists
GET /connz?sort=pending        → Sort by pending bytes
GET /connz?state=closed        → Recently closed connections
GET /routez                    → Cluster routes
GET /routez?subs=1             → Routes with subscriptions
GET /gatewayz                  → Gateway connections
GET /gatewayz?accs=true        → Gateways with account info
GET /leafz                     → Leaf node connections
GET /leafz?subs=1              → Leaf nodes with subscriptions
GET /subsz                     → Subscription routing stats
GET /subsz?subs=1              → With subscription list
GET /accountz                  → Account details
GET /accountz?acc=myAccount    → One specific account
GET /accstatz                  → Per-account stats summary
GET /jsz                       → JetStream summary
GET /jsz?accounts=true         → Include per-account breakdown
GET /jsz?streams=true          → Include stream list
GET /jsz?consumers=true        → Include consumer list (needs streams=true)
GET /jsz?config=true           → Include full configs
GET /jsz?leader-only=true      → Only from RAFT leader (use in clusters)
GET /healthz                   → Health check (returns 200 or 503)
GET /healthz?js-enabled=true   → Fail if JetStream disabled
GET /stacksz                   → Goroutine stack dump (debug)
```

---

## APPENDIX B: Sample JSON Responses

### /varz sample (abbreviated):
```json
{
  "server_id": "NAABC123",
  "server_name": "my-nats-server",
  "version": "2.10.5",
  "go": "go1.21.0",
  "host": "0.0.0.0",
  "port": 4222,
  "max_connections": 65536,
  "connections": 42,
  "total_connections": 1203,
  "routes": 2,
  "remotes": 2,
  "leafnodes": 5,
  "in_msgs": 8472931,
  "out_msgs": 8412000,
  "in_bytes": 1073741824,
  "out_bytes": 1069547520,
  "slow_consumers": 0,
  "subscriptions": 189,
  "mem": 52428800,
  "cores": 8,
  "cpu": 3.5,
  "uptime": "3d14h22m",
  "start": "2026-03-12T01:00:00Z",
  "now": "2026-03-15T15:22:00Z"
}
```

### /jsz consumer sample (abbreviated):
```json
{
  "stream_name": "ORDERS",
  "name": "orders-processor",
  "config": {
    "durable_name": "orders-processor",
    "ack_policy": "explicit",
    "ack_wait": 30000000000,
    "max_deliver": 3,
    "filter_subject": "orders.>"
  },
  "delivered": {
    "consumer_seq": 9823,
    "stream_seq": 9823
  },
  "ack_floor": {
    "consumer_seq": 9820,
    "stream_seq": 9820
  },
  "num_ack_pending": 3,
  "num_redelivered": 12,
  "num_waiting": 0,
  "num_pending": 177
}
```

---

*End of NATS Dashboard Master Plan*
*Document version: 1.0 | For use with AI code generation*