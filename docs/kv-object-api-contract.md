# KV/Object API Contract

This dashboard exposes first-class endpoints for NATS KV and Object bucket workflows.
All endpoints accept optional connection overrides:

- `server`: NATS URL to target.
- `token`: token used for auth when connecting.

When omitted, the backend uses configured defaults.

## KV APIs

- `GET /api/kv/buckets`
  - Lists KV buckets.
- `GET /api/kv/bucket/:bucket`
  - Returns bucket status and config where available.
- `POST /api/kv/bucket/create`
  - Body: `{ bucket, description?, history?, ttl?, maxValueSize?, maxBucketSize?, replicas?, storage?, compression? }`
- `POST /api/kv/bucket/update`
  - Body: same as create.
- `POST /api/kv/bucket/delete`
  - Body: `{ bucket }`
- `POST /api/kv/bucket/purge`
  - Body: `{ bucket }`

- `GET /api/kv/keys?bucket=<name>`
  - Lists keys in a bucket.
- `POST /api/kv/entry/get`
  - Body: `{ bucket, key }`
- `POST /api/kv/entry/put`
  - Body: `{ bucket, key, value, encoding? }`
  - `encoding`: `utf8` (default), `base64`, or `json`.
- `POST /api/kv/entry/delete`
  - Body: `{ bucket, key }`
- `POST /api/kv/entry/purge`
  - Body: `{ bucket, key }`
- `POST /api/kv/entry/history`
  - Body: `{ bucket, key }`

- `GET /api/kv/watch?bucket=<name>&key=<optional>&updatesOnly=<optional>`
  - Server-sent events stream (`text/event-stream`).

- `POST /api/kv/command`
  - Body: `{ args: string[] }`
  - Escape hatch for full CLI feature parity.

## Object APIs

- `GET /api/object/buckets`
  - Lists object buckets.
- `GET /api/object/bucket/:bucket`
  - Returns bucket status.
- `POST /api/object/bucket/create`
  - Body: `{ bucket, description?, ttl?, maxBucketSize?, replicas?, storage?, compression? }`
- `POST /api/object/bucket/delete`
  - Body: `{ bucket }`
- `POST /api/object/bucket/seal`
  - Body: `{ bucket }`

- `GET /api/object/list?bucket=<name>`
  - Lists objects in a bucket.
- `POST /api/object/get`
  - Body: `{ bucket, name }`
- `POST /api/object/put`
  - Body: `{ bucket, name, content, encoding? }`
  - `encoding`: `utf8` (default), `base64`.
- `POST /api/object/delete`
  - Body: `{ bucket, name }`
- `POST /api/object/info`
  - Body: `{ bucket, name }`
- `POST /api/object/link`
  - Body: `{ bucket, name, targetBucket, targetName? }`

- `GET /api/object/watch?bucket=<name>&name=<optional>&updatesOnly=<optional>`
  - Server-sent events stream (`text/event-stream`).

- `POST /api/object/command`
  - Body: `{ args: string[] }`
  - Escape hatch for full CLI feature parity.

## Response Shape

Success:

```json
{ "ok": true, "data": {} }
```

Errors:

```json
{ "ok": false, "error": "message" }
```

Command endpoints also include `stdout`, `stderr`, `exitCode`, and `durationMs`.
