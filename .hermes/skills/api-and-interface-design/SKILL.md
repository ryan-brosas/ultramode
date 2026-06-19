---
name: api-and-interface-design
description: Use when designing REST/GraphQL APIs, SDK interfaces, or public module boundaries — covers contract-first design, versioning, error shapes, and backward compatibility rules.
---

# API & Interface Design

APIs are contracts. Once published, they're hard to change without breaking consumers. Design the contract first, implement second.

**Core principle:** Define the contract (types, errors, versioning) before writing implementation. Make breaking changes impossible through careful interface design.

## When to Use

- Designing a new API endpoint, SDK method, or public module interface
- Reviewing or extending an existing API for backward compatibility
- Defining error responses, pagination, or authentication contracts

## When NOT to Use

- Internal-only helper functions with no external consumers
- Prototyping where the API shape will change frequently

## Contract-First Process

```
1. DEFINE  — Write types / schema for request & response
2. REVIEW  — Check backward compatibility, error coverage, naming consistency
3. IMPLEMENT — Code against the contract, not the other way around
4. VERIFY  — Validate implementation matches contract exactly
```

## API Design Checklist

### Naming

- Resource-oriented URLs (nouns, not verbs): `/users/{id}` not `/getUser`
- Consistent casing (camelCase for JSON, kebab-case for URLs)
- Plural collection names: `/users` not `/user`
- Avoid abbreviations in public APIs: `configuration` not `config`

### Request Design

- Use appropriate HTTP methods: GET reads, POST creates, PUT replaces, PATCH updates, DELETE removes
- Validate all input with schemas at the boundary
- Accept only what you need — reject unknown fields
- Use query params for filtering/pagination, body for creation/mutation

### Response Design

- Consistent envelope or flat convention — pick one, stick to it
- Include pagination metadata: `{ total, page, pageSize, hasMore }`
- Return created/updated resource in mutation responses
- Use ISO 8601 for dates, UTC always

### Error Design

```typescript
// Consistent error shape
interface ApiError {
  code: string;      // Machine-readable: "VALIDATION_ERROR", "NOT_FOUND"
  message: string;   // Human-readable description
  details?: unknown; // Field-level errors, context
  requestId?: string; // Correlation ID for debugging
}
```

- Use standard HTTP status codes correctly (400 vs 422 vs 500)
- Never expose stack traces or internal errors to clients
- Include actionable error messages
- Document all possible error codes per endpoint

### Versioning

| Strategy | When | Example |
|----------|------|---------|
| URL prefix | Breaking changes to resources | `/v1/users`, `/v2/users` |
| Header | Breaking changes, same URL | `Accept: application/vnd.api.v2+json` |
| Query param | Simple, low-ceremony | `/users?version=2` |
| No versioning | Internal APIs, single consumer | Direct updates |

**Default:** URL prefix versioning for public APIs, no versioning for internal.

### Backward Compatibility Rules

| Safe (Non-Breaking) | Unsafe (Breaking) |
|--------------------|-------------------|
| Add optional fields | Remove or rename fields |
| Add new endpoints | Change field types |
| Add new enum values | Remove enum values |
| Widen input validation | Tighten input validation |
| Add optional query params | Change URL structure |

## TypeScript Patterns

### Strict Input/Output Types

```typescript
// ✅ Separate input and output types
interface CreateUserInput {
  name: string;
  email: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string; // ISO 8601
}

// ✅ Validate at boundary
const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});
```

### Discriminated Unions for Results

```typescript
type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };
```

## Common Rationalizations

| Excuse | Rebuttal |
|--------|----------|
| "It's just an internal API" | Internal APIs become external. Design the contract now. |
| "We can change it later" | Every consumer you add makes changes harder. Get it right early. |
| "Error handling is boilerplate" | Inconsistent errors cause more debugging than any boilerplate saves. |
| "Versioning is overkill for now" | Adding versioning later requires migrating all consumers simultaneously. |

## Red Flags — STOP

- Endpoint returns different shapes depending on internal state
- Error responses have no consistent structure
- URL contains verbs (`/createUser`, `/deleteItem`)
- No input validation at the API boundary
- Response includes internal database IDs or implementation details
- Breaking change deployed without version bump

## Verification

- [ ] All endpoints have typed request/response schemas
- [ ] Error responses follow the consistent error shape
- [ ] Breaking changes increment the API version
- [ ] Input validation rejects invalid/extra fields
- [ ] Response matches documented contract exactly

## Anti-Patterns

| Anti-Pattern | Instead |
|-------------|---------|
| Designing APIs around internal data structures | Design around consumer use cases |
| Returning raw internal state | Return DTOs/views that decouple from implementation |
| Versioning by adding optional fields forever | Plan versioning strategy from the start |
| Endpoints that do too much | One endpoint = one operation; compose on the client |
