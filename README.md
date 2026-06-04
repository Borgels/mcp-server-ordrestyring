# mcp-server-ordrestyring

TypeScript MCP server for Ordrestyring's GraphQL API. It is intentionally boring
good: typed, documented, read-first, policy-aware, credential-sane, and
audit-friendly.

> **Disclaimer:** This is an independent, unofficial project by Borgels. Borgels
> is not affiliated with, endorsed by, or supported by Ordrestyring. "Ordrestyring"
> and the Ordrestyring GraphQL API are referenced only to describe what this
> server talks to. You need your own Ordrestyring API token, and use of the API is
> subject to Ordrestyring's own terms.

## Scope

The server exposes Ordrestyring through three layers:

- Curated MCP tools for connection checks, schema discovery, cases, customers,
  time, materials, planning, documents, quality checks, invoice drafts, and
  read-only reporting.
- A guarded GraphQL read tool for long-tail query coverage.
- A dry-run + commit flow for mutations, disabled by default and gated by policy.

Default install mode is read-only. Mutations require explicit environment opt-in,
a prepared operation hash, a reason, an idempotency key for the audit trail, and
optional policy-file approval.

## Setup

Install dependencies and build the CLI:

```sh
npm install
npm run build
```

Set Ordrestyring credentials in the MCP server environment. The server sends the
token as `Authorization: Bearer ...` and never accepts credentials as tool
arguments.

```sh
export ORDRESTYRING_API_TOKEN="your-api-token"
```

Optional hardening settings:

```sh
export ORDRESTYRING_TIMEOUT_MS=30000
export ORDRESTYRING_AUDIT_LOG="/absolute/path/to/ordrestyring-audit.jsonl"
```

## Claude Or Cursor Config

Use the stdio server for local MCP clients:

```json
{
  "mcpServers": {
    "ordrestyring": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-ordrestyring/dist/stdio.js"],
      "env": {
        "ORDRESTYRING_API_TOKEN": "your-api-token",
        "ORDRESTYRING_TIMEOUT_MS": "30000"
      }
    }
  }
}
```

During development:

```json
{
  "mcpServers": {
    "ordrestyring": {
      "command": "npm",
      "args": ["run", "dev", "--prefix", "/absolute/path/to/mcp-server-ordrestyring"],
      "env": {
        "ORDRESTYRING_API_TOKEN": "your-api-token",
        "ORDRESTYRING_AUDIT_LOG": "/absolute/path/to/ordrestyring-audit.jsonl"
      }
    }
  }
}
```

## Start Here

Ask the MCP client to call:

- `ordrestyring_diagnostics` to verify credentials and live schema coverage.
- `ordrestyring_search_capabilities` to find tools and examples.
- `ordrestyring_get_capability` to inspect one tool before using it.
- `ordrestyring_check_connection` to verify credentials.
- `ordrestyring_search_schema` to find API fields before using a focused tool.

## Tools

All read tools are registered with MCP tool annotations (`readOnlyHint`,
`destructiveHint`, `idempotentHint`, and `openWorldHint`) so clients can reason
about safety. The domain tools are schema-aware: they use authenticated
introspection, send only arguments exposed by the live schema, and fail clearly
when the API does not expose a required workflow field.

### Discovery

- `ordrestyring_search_capabilities` — search this MCP server's capabilities.
- `ordrestyring_get_capability` — inspect one discovered capability.
- `ordrestyring_check_connection` — verify the configured API token.
- `ordrestyring_diagnostics` — check auth, schema counts, and workflow field
  availability.
- `ordrestyring_introspect_schema` — fetch top-level Query and Mutation fields.
- `ordrestyring_search_schema` — search GraphQL types, fields, and arguments.
- `ordrestyring_get_schema_type` — inspect one GraphQL type by exact name.
- `ordrestyring_refresh_schema` — clear and refetch the per-process schema cache.

```json
{
  "query": "case customer",
  "limit": 10
}
```

### Cases And Customers

- `ordrestyring_list_cases` — stable documented `cases` query selecting `id` and
  `caseNumber`.
- `ordrestyring_get_case` — stable documented `caseById` query selecting `id`
  and `caseNumber`.
- `ordrestyring_search_cases` — schema-aware case search/filter by query,
  status, customer, update range, cursor, and order when supported.
- `ordrestyring_get_case_overview` — schema-aware case details with common
  scalar fields and related customer/user fields where available.
- `ordrestyring_search_customers` — schema-aware customer list/search.
- `ordrestyring_get_customer_overview` — schema-aware customer detail by id.
- `ordrestyring_search_creditors` — schema-aware supplier/creditor
  list/search by name, number, or VAT number.
- `ordrestyring_get_creditor` — supplier/creditor detail by creditor number.
- `ordrestyring_search_products` — product/item list/search by number,
  description, and product type.
- `ordrestyring_get_product` — product/item detail by id.
- `ordrestyring_search_hour_types` — hour types with linked time products.

```json
{
  "query": "service",
  "customerId": 456,
  "statusId": 7,
  "limit": 20
}
```

### Operations

- `ordrestyring_list_case_time_entries` — time registrations by case, date range,
  user, or employee when supported.
- `ordrestyring_summarize_time` — local aggregate of numeric time fields from
  returned registrations.
- `ordrestyring_list_case_materials` — material registrations by case and date
  range when supported.
- `ordrestyring_get_case_financials` — case economy/profitability fields where
  exposed by the schema.
- `ordrestyring_list_schedule` — planning/calendar entries by date range,
  employee, or case when supported.
- `ordrestyring_list_case_documents` — document/photo/attachment metadata only.
- `ordrestyring_list_case_quality_checks` — KS/checklist/form status by case.
- `ordrestyring_list_invoice_drafts` — invoice draft/pipeline records only; no
  send, book, export, or accounting mutation.
- `ordrestyring_get_case_activity` — case activities and status history.
- `ordrestyring_find_billable_cases` — find cases that look ready for billing
  review.
- `ordrestyring_get_case_work_summary` — combined hours/materials summary for a
  case.
- `ordrestyring_get_case_health` — case overview, activity, work, documents,
  quality checks, and billing readiness in one response.
- `ordrestyring_find_stale_cases` — find cases not updated for a configurable
  number of days.
- `ordrestyring_get_invoice_readiness` — case overview, uninvoiced work,
  existing drafts, and financials for billing review.
- `ordrestyring_get_billing_pipeline` — sales invoice drafts and invoices for
  pipeline review.
- `ordrestyring_get_unbilled_work_report` — summarize uninvoiced hours and
  materials.
- `ordrestyring_get_operational_model` — show the recommended
  Ordrestyring/e-conomic ownership boundary and live mutation coverage.
- `ordrestyring_get_business_report` — report wrapper for `hours`, `materials`,
  `case_profitability`, and `invoice_pipeline`.

Example:

```json
{
  "caseId": 123,
  "dateFrom": "2026-01-01",
  "dateTo": "2026-01-31",
  "limit": 100
}
```

### Operational Writes

These tools create or convert operational records directly when writes are
enabled and policy allows the underlying mutation:

- `ordrestyring_create_customer`
- `ordrestyring_create_case`
- `ordrestyring_create_case_activity`
- `ordrestyring_create_offer`
- `ordrestyring_convert_offer_to_case`
- `ordrestyring_create_product`
- `ordrestyring_update_product`
- `ordrestyring_delete_products`
- `ordrestyring_create_hour_type`
- `ordrestyring_update_hour_type`
- `ordrestyring_create_case_material`
- `ordrestyring_create_sales_invoice_draft`
- `ordrestyring_create_creditor`

Example:

```json
{
  "input": {
    "customerId": 123,
    "description": "Udskiftning af pumpe"
  },
  "reason": "Customer requested an offer.",
  "idempotencyKey": "offer-123-pump-2026-05-25"
}
```

### Long-Tail Reads

`ordrestyring_graphql_read` runs a validated GraphQL query operation for
long-tail read coverage.

```json
{
  "query": "query($cursor: String) { cases(pagination: {cursor: $cursor, limit: 10}, orderBy: {field: \"updatedAt\", direction: DESC}) { items { id caseNumber } nextCursor previousCursor } }",
  "variables": {
    "cursor": null
  }
}
```

Mutation and subscription documents are rejected before any network call.

## Write Policy

Mutations are blocked unless explicitly enabled:

```sh
export ORDRESTYRING_ENABLE_WRITES=true
export ORDRESTYRING_POLICY_PATH="/absolute/path/to/ordrestyring-policy.json"
export ORDRESTYRING_AUDIT_LOG="/absolute/path/to/ordrestyring-audit.jsonl"
```

Example policy:

```json
{
  "writesEnabled": true,
  "allowedMutations": ["updateUser"],
  "deniedMutationPatterns": ["^delete", "upload"],
  "maxVariableBytes": 20000
}
```

Write flow:

1. Prefer a focused direct tool such as `ordrestyring_create_offer` or
   `ordrestyring_create_case`.
2. For advanced/debug flows, call `ordrestyring_prepare_mutation` or
   `ordrestyring_prepare_operational_mutation`, inspect the returned
   `operationHash`, then call `ordrestyring_commit_prepared_mutation`.
3. Keep `allowedMutations` narrow in the policy file, for example
   `["createOffer", "createCase"]` while testing.

`idempotencyKey` is stored only as a hash in the audit log. Ordrestyring's public
GraphQL docs do not document an idempotency header, so this server does not send
one upstream.

### Ordrestyring And e-conomic

The recommended ownership boundary is: Ordrestyring owns daily operations
(offers, cases/orders, planning, time/materials, documentation, KS, and invoice
draft readiness), while e-conomic stays the financial ledger for accounts, VAT,
booked invoices, payments, reconciliation, and accounting reports. Ordrestyring
publishes an e-conomic integration, so prefer the product integration for routine
sync and use MCP tools for governed inspection, preparation, and exception
handling.

## Security And Audit

If `ORDRESTYRING_AUDIT_LOG` is set, every tool attempt writes a JSONL record with
timestamp, request id, tool, target hash, policy decision, operation hash,
idempotency-key hash, status, and redacted errors. Tokens are never logged
intentionally.

Credentials are read only from the MCP server environment and are never accepted
as tool arguments. Report suspected vulnerabilities privately to
<security@borgels.com>. Do not include API tokens, customer data, or other
secrets in public GitHub issues.

## Optional HTTP Server

The local stdio transport is the default. A small Streamable HTTP entrypoint is
available:

```sh
PORT=3000 ORDRESTYRING_API_TOKEN="your-api-token" npm run dev:http
```

By default the HTTP server binds to `127.0.0.1`, limits request bodies to 10 MiB,
allows browser CORS only from loopback origins, and does not require an HTTP
Bearer token. You can override this with `MCP_HTTP_HOST`, `MCP_MAX_BODY_BYTES`,
`MCP_ALLOWED_ORIGINS`, `MCP_ALLOW_ANY_ORIGIN=true`, and `MCP_HTTP_TOKEN`.

The MCP endpoint is `POST http://127.0.0.1:3000/mcp`.

## Borgels Gateway Export

`mcp-server-ordrestyring/gateway` exposes a small typed adapter for Borgels
control-plane runtimes that need to wrap this server without copying connector
logic.

The gateway exports:

- `ordrestyringGatewayTools`: stable unprefixed tool definitions with name,
  title, description, risk level, default enablement, and JSON input schema.
- `createOrdrestyringGateway(options)`: a factory that accepts the same
  credential, base URL, timeout, and `fetchImpl` options as `OrdrestyringClient`.

First-wedge gateway tools:

- `check_connection`
- `search_cases`
- `get_case_health`
- `find_billable_cases`
- `get_invoice_readiness`
- `create_customer` (disabled by default)
- `delete_products` (disabled by default, destructive)

The gateway reads credentials from the server environment or factory options,
never from tool arguments. Write tools remain disabled unless
`ORDRESTYRING_ENABLE_WRITES=true` and the write policy allows the underlying
mutation. This makes the gateway suitable for Borgels review and fixture
automation while preserving the same safety model as the full MCP server.

## Rate Limits

Ordrestyring documents GraphQL rate limiting with `Retry-After`,
`X-RateLimit-Limit`, and `X-RateLimit-Remaining` headers. HTTP failures include
those values in formatted errors when Ordrestyring returns them. GraphQL
responses with an `errors` array are treated as tool errors even when HTTP status
is 2xx, matching Ordrestyring's documented error model.

## Schema Cache

Schema-aware tools cache authenticated introspection for the lifetime of the
server process. Use `ordrestyring_refresh_schema` after Ordrestyring changes the
schema or after enabling new API access on a token. Restarting the MCP server
also clears the cache.

## Verification

Run checks without real credentials:

```sh
npm run typecheck
npm test
npm run build
```

Run the optional live smoke test only when you have a valid Ordrestyring API
token:

```sh
ORDRESTYRING_API_TOKEN="your-api-token" npm run smoke:live
```

After `npm run build`, run the MCP stdio smoke test to verify the packaged
server registers tools and can call Ordrestyring through MCP:

```sh
ORDRESTYRING_API_TOKEN="your-api-token" npm run smoke:mcp
```

## API Sources

- GraphQL docs: <https://graphql.ordrestyring.dk/docs>
- GraphiQL UI: <https://graphql.ordrestyring.dk/graphiql>
- Ordrestyring e-conomic integration: <https://ordrestyring.dk/integrationspartnere/e-conomic/>
- e-conomic app listing for Ordrestyring: <https://www.e-conomic.dk/apps-og-udvidelser/ordrestyringdk>
- Legacy REST API notice: <https://api.ordrestyring.dk/>

## License

Apache-2.0. See [LICENSE](LICENSE).
