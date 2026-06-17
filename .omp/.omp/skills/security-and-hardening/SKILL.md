---
name: security-and-hardening
description: Use when auditing for vulnerabilities, implementing auth, handling secrets, or hardening against OWASP Top 10 — covers validation, auth, dependency auditing, and secure defaults. Includes concrete sink catalog across JS/TS, Python, Go, and CI config.
---

# Security & Hardening

Security is a constraint, not a feature. It should be present by default and requires explicit justification to relax.

**Core principle:** Validate all input. Authenticate all access. Encrypt all secrets. Audit all dependencies. Trust nothing from outside your process boundary.

## Three-Layer Defense

| Layer | Trigger | Scope |
|-------|---------|-------|
| 1. Pattern warnings | On `Edit`/`Write` | Instant regex match against known-dangerous patterns. Prevents commit of obvious sinks. |
| 2. Diff review | On `Stop` (response complete) | LLM reviews the diff for multi-line vulnerabilities. Catches what patterns miss. |
| 3. Commit review | On `git commit`/`push` | Agentic reviewer traces data flow across files. Catches cross-file vulns (IDOR, auth bypass, SSRF chains). |

This skill covers layer-1 knowledge (the sink catalog). The `security-guidance` plugin (if installed) provides automated layer-2/3 enforcement in the edit loop.

## When to Use

- Implementing authentication or authorization
- Handling user input that touches databases, file systems, or external services
- Reviewing code for security vulnerabilities
- Running dependency audits or responding to CVE alerts

## When NOT to Use

- Local-only developer tools with no network exposure
- Throwaway prototypes that will never see user data

## Security Boundaries

### Always

- Validate and sanitize all user input at the boundary
- Use parameterized queries (never string interpolation for SQL)
- Hash passwords with bcrypt/scrypt/argon2 (never MD5/SHA for passwords)
- Use HTTPS for all external communication
- Store secrets in environment variables, never in code
- Set secure defaults (CORS restrictive, CSP strict, cookies httpOnly+secure)

### Never

- Commit secrets, API keys, or credentials to git
- Disable CSRF protection
- Use `eval()` or `Function()` with user input
- Trust client-side validation as the only validation
- Log sensitive data (passwords, tokens, PII)

## OWASP Top 5 Patterns

### 1. Injection (SQL, NoSQL, Command)

```typescript
// ❌ SQL Injection
const user = await db.query(`SELECT * FROM users WHERE id = '${userId}'`);

// ✅ Parameterized query
const user = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
```

```typescript
// ❌ Command injection
exec(`convert ${filename} output.png`);

// ✅ Safe argument passing
execFile("convert", [filename, "output.png"]);
```

### 2. Broken Authentication

```typescript
// ✅ Password hashing
const hash = await bcrypt.hash(password, 12); // cost factor 12
const valid = await bcrypt.compare(input, hash);

// ✅ Session management
const session = {
  httpOnly: true,  // No JS access
  secure: true,    // HTTPS only
  sameSite: "lax", // CSRF protection
  maxAge: 3600,    // 1 hour expiry
};
```

### 3. Sensitive Data Exposure

```typescript
// ❌ Logging sensitive data
console.log("User login:", { email, password });

// ✅ Redact sensitive fields
console.log("User login:", { email, password: "[REDACTED]" });

// ✅ API response excludes internal fields
function toPublicUser(user: DbUser): PublicUser {
  const { passwordHash, internalId, ...publicFields } = user;
  return publicFields;
}
```

### 4. Broken Access Control

```typescript
// ❌ No authorization check
app.get("/api/users/:id", async (req, res) => {
  const user = await getUser(req.params.id);
  res.json(user); // Any authenticated user can access any profile!
});

// ✅ Authorization check
app.get("/api/users/:id", async (req, res) => {
  const user = await getUser(req.params.id);
  if (user.id !== req.auth.userId && !req.auth.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(user);
});
```

### 5. Security Misconfiguration

```typescript
// ✅ Secure headers
import helmet from "helmet";
app.use(helmet());

// ✅ CORS — restrictive by default
app.use(cors({
  origin: ["https://myapp.com"], // Not '*'
  methods: ["GET", "POST"],
  credentials: true,
}));

// ✅ CSP
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"], // No 'unsafe-inline'
  },
}));
```

## Input Validation Patterns

```typescript
import { z } from "zod";

// ✅ Validate at the boundary
const createUserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().max(254),
  age: z.number().int().min(0).max(150).optional(),
});

// ✅ Reject unknown fields
const input = createUserSchema.strict().parse(req.body);
```

| Input Type | Validation |
|-----------|------------|
| String | Min/max length, regex pattern, trim |
| Number | Min/max range, integer check |
| Email | Format validation, max 254 chars |
| URL | Protocol whitelist (https only) |
| File upload | Type whitelist, max size, content validation |
| Array | Max length, item validation |

## Dependency Audit

| Severity | Action | Timeline |
|----------|--------|----------|
| Critical | Fix immediately | Same day |
| High | Fix in current sprint | Within 1 week |
| Medium | Plan fix | Within 1 month |
| Low | Track and monitor | Next convenient update |

- Commit lockfiles (`package-lock.json`, `pnpm-lock.yaml`)
- Pin major versions in production dependencies
- Review new dependencies before adding (maintainers, download count, last update)
- Run `npm audit` or `pnpm audit` in CI

## Secrets Management

| Rule | Implementation |
|------|---------------|
| Never in code | Use `.env` files (gitignored) or secret managers |
| Never in logs | Redact before logging |
| Never in URLs | Use headers or body for tokens |
| Rotate on exposure | Immediate rotation + audit trail |
| Different per environment | Staging keys ≠ production keys |
| Least privilege | Each secret grants minimum required access |

```bash
# ✅ .gitignore
.env
.env.local
.env.*.local
*.key
*.pem
```

## Rate Limiting

```typescript
// ✅ Basic rate limiting
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// ✅ Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
});
app.use("/api/auth/", authLimiter);
```

---

## Concrete Security Sink Catalog

Every entry: sink name, language, unsafe example, safe example, vulnerability class. These are the patterns a security review must catch.

### JavaScript / TypeScript

#### 1. `child_process.exec()` — Command Injection
```ts
// ❌ Shell string + user input = command injection
exec(`convert ${filename} output.png`);

// ✅ Argument array, no shell
import { execFile } from "node:child_process";
execFile("convert", [filename, "output.png"]);
```
Only use `exec()` if you absolutely need shell features AND input is guaranteed safe.

#### 2. `new Function()` — Code Injection
```ts
// ❌ String interpolation into function body
const fn = new Function("x", `return ${userExpr}`);

// ✅ Safe alternatives
const value = obj[key];                              // Property access
const result = path.split(".").reduce((o, k) => o[k], root); // Path traversal
```
Never interpolate untrusted strings into `new Function()` bodies.

#### 3. `eval()` — Arbitrary Code Execution
```ts
// ❌ eval with any user input
const result = eval(userInput);

// ✅ JSON.parse for data, safe expression parser for computation
const data = JSON.parse(jsonString);
```
`eval()` is a code execution backdoor. There is always a safer alternative.

#### 4. `dangerouslySetInnerHTML` — XSS
```tsx
// ❌ Raw HTML from untrusted source
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ Sanitize with DOMPurify
import DOMPurify from "dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

#### 5. `.innerHTML =` — XSS
```ts
// ❌ innerHTML with untrusted content
element.innerHTML = userComment;

// ✅ textContent for plain text
element.textContent = userComment;

// ✅ Or sanitize
element.innerHTML = DOMPurify.sanitize(userComment);
```

#### 6. `.outerHTML =` — XSS
```ts
// ❌ Same risk surface as innerHTML
element.outerHTML = userHtml;

// ✅ textContent or DOMPurify
element.textContent = userText;
```

#### 7. `.insertAdjacentHTML()` — XSS
```ts
// ❌ Another XSS sink
element.insertAdjacentHTML("beforeend", userHtml);

// ✅ insertAdjacentText for plain text
element.insertAdjacentText("beforeend", userText);
```

#### 8. `document.write()` — XSS + Performance
```ts
// ❌ Blocks parsing, XSS vector
document.write(userContent);

// ✅ DOM manipulation
const el = document.createElement("div");
el.textContent = userContent;
document.body.appendChild(el);
```

#### 9. `crypto.createCipher()` — Weak Crypto
```ts
// ❌ Deprecated in Node 22. No IV, MD5-based KDF.
const cipher = crypto.createCipher("aes-256-cbc", key);

// ✅ Use createCipheriv with proper IV
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
```

#### 10. `rejectUnauthorized: false` — TLS Disabled
```ts
// ❌ Accepts any certificate. MITM trivial.
const agent = new https.Agent({ rejectUnauthorized: false });

// ✅ Proper CA trust (default)
const agent = new https.Agent(); // rejectUnauthorized: true by default
```
For self-signed dev certs: add the CA to your trust store. Never disable globally.

### Python

#### 11. `pickle.load()` — Arbitrary Code Execution
```py
# ❌ pickle from untrusted source = RCE
data = pickle.load(untrusted_file)

# ✅ JSON for simple data
data = json.load(file)

# ✅ Schema-validated deserializer for typed objects
data = msgspec.json.decode(file.read(), type=MyStruct)
```
Also covers: `cPickle`, `cloudpickle`, `dill`, `marshal.load()`, `shelve.open()`, `joblib.load()`, `pandas.read_pickle()`.

#### 12. `numpy.load(allow_pickle=True)` — RCE
```py
# ❌ Pickle-enabled numpy load = RCE
data = np.load(file, allow_pickle=True)

# ✅ Default since numpy 1.16.3 is allow_pickle=False
data = np.load(file)
```

#### 13. `torch.load()` — RCE
```py
# ❌ Defaults to weights_only=False = pickle RCE
model = torch.load("model.pt")

# ✅ Explicitly safe
model = torch.load("model.pt", weights_only=True)
```

#### 14. `yaml.load()` — RCE via `!!python/object`
```py
# ❌ Full YAML = arbitrary Python objects
data = yaml.load(file)

# ✅ Safe load only handles basic types
data = yaml.safe_load(file)
```
Also covers: `yaml.unsafe_load()` variants.

#### 15. `xml.etree.ElementTree.parse()` — XXE / Billion Laughs
```py
# ❌ stdlib XML parsers are XXE-vulnerable by default
tree = ET.parse(untrusted_xml)

# ✅ defusedxml
from defusedxml import ElementTree as SafeET
tree = SafeET.parse(untrusted_xml)
```
Also: `minidom.parse()`, `xml.sax.parse()`. All stdlib XML = vulnerable.

#### 16. `os.system()` — Command Injection
```py
# ❌ Shell execution with user input
os.system(f"ping {host}")

# ✅ Argument list, no shell
subprocess.run(["ping", host])
```

#### 17. `subprocess.run(shell=True)` — Command Injection
```py
# ❌ shell=True + user input
subprocess.run(f"ls {path}", shell=True)

# ✅ Argument list
subprocess.run(["ls", path])
```
When arguments are a list without `shell=True`, metacharacters are inert.

#### 18. `AES.MODE_ECB` — Weak Encryption
```py
# ❌ ECB mode leaks plaintext structure
cipher = AES.new(key, AES.MODE_ECB)

# ✅ GCM (authenticated) or CBC + HMAC
cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
```
Identical plaintext blocks → identical ciphertext blocks in ECB. Visible structure = broken.

### Go

#### 19. `exec.Command("sh", "-c", ...)` — Command Injection
```go
// ❌ Shell interpreter + user input = injection
cmd := exec.Command("sh", "-c", "ping -c 1 "+host)

// ✅ Direct argument passing, no shell
cmd := exec.Command("ping", "-c", "1", host)
```
Validate: IPs via `net.ParseIP()`, paths via `filepath.Clean()`, numerics via `strconv`.

#### 20. `tls.Config{InsecureSkipVerify: true}` — TLS Disabled
```go
// ❌ MITM trivial
client := &http.Client{
    Transport: &http.Transport{
        TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
    },
}

// ✅ Default verification
client := &http.Client{} // InsecureSkipVerify defaults to false
```

### Configuration / CI

#### 21. GitHub Actions Workflow Injection
```yaml
# ❌ Untrusted input in run: — command injection
run: echo "${{ github.event.issue.title }}"

# ✅ Environment variable + quoting
env:
  TITLE: ${{ github.event.issue.title }}
run: echo "$TITLE"
```
Risky inputs: `issue.title`, `issue.body`, `pr.title`, `pr.body`, `comment.body`, `commits.*.message`, `head_ref`, `client_payload.*`.

#### 22. GitHub Actions Ref Injection
```yaml
# ❌ Untrusted input in ref: = checkout arbitrary branches
- uses: actions/checkout@v4
  with:
    ref: ${{ github.event.client_payload.branch }}

# ✅ Validate before use
- run: |
    if [[ ! "${{ github.event.client_payload.branch }}" =~ ^[a-zA-Z0-9._/-]+$ ]]; then
      echo "Invalid branch name" && exit 1
    fi
```

### Cross-Language

#### 23. Hardcoded Secrets
```ts
// ❌ In source
const API_KEY = "sk-live-abc123...";

// ✅ Environment variable
const API_KEY = process.env.API_KEY;
```
Also: `.env` files in `.gitignore`, secrets manager for production, rotation on exposure.

#### 24. TLS Verification Disabled
```py
# ❌ Python
requests.get(url, verify=False)
# ❌ Node
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
# ❌ Python
ssl._create_unverified_context()
# ❌ Python
check_hostname = False
```
Any form of TLS disable = MITM possible. Fix: install proper certificates.

#### 25. Script Tag Without Subresource Integrity
```html
<!-- ❌ No integrity check — CDN compromise = XSS -->
<script src="https://cdn.example.com/lib@1.2.3/bundle.js"></script>

<!-- ✅ SRI pins the exact content -->
<script src="https://cdn.example.com/lib@1.2.3/bundle.js"
        integrity="sha384-hash"
        crossorigin="anonymous"></script>
```

---

## Project-Specific Security Policy

For org-specific rules the generic catalog can't cover, create `.omp/security-policy.md`:

```markdown
# <Project> Security Rules

- All SELECTs against the `customers` table MUST go through `db.replica`, never `db.primary`.
- Background jobs must not use user-context auth tokens.
- Calls to `fetch(url)` with user-controlled `url` need the SSRF-allowlist wrapper.
- <org-specific crypto rules, data handling policies, etc.>
```

Loaded by the `security-guidance` plugin if installed. Without the plugin, agents should read this file directly during `/review`. Keep under 8KB total. Local overrides go in `.omp/security-policy.local.md` (gitignored).

## Common Rationalizations

| Excuse | Rebuttal |
|--------|----------|
| "It's an internal app" | Internal apps get compromised too. Validate all input. |
| "We'll add security before launch" | Security retrofit is 10x harder than building it in. |
| "Nobody will find this endpoint" | Security through obscurity isn't security. |
| "The framework handles it" | Frameworks have defaults, not guarantees. Verify your config. |
| "This is just a prototype" | Prototypes become production. Build secure habits from day one. |
| "The input is from a trusted source" | Trust boundaries shift. Validate at every boundary regardless. |

## Red Flags — STOP

- String concatenation in SQL queries
- Passwords stored in plaintext or MD5/SHA
- API keys or secrets in source code
- CORS set to `*` in production
- No rate limiting on authentication endpoints
- User input passed directly to `exec()`, `eval()`, `new Function()`, `os.system()`, or `subprocess(shell=True)`
- `pickle.load()` / `yaml.load()` / `torch.load()` / `marshal.load()` on untrusted data
- `rejectUnauthorized: false` / `InsecureSkipVerify: true` / `verify=False`
- Dependencies with known critical CVEs
- No input validation at API boundaries
- GitHub Actions workflows interpolating `github.event.*` directly into `run:`
- `dangerouslySetInnerHTML` / `innerHTML` / `outerHTML` without sanitization

## Verification

- [ ] All user input validated with schemas at API boundaries
- [ ] SQL queries use parameterized statements
- [ ] Passwords hashed with bcrypt/scrypt/argon2 (cost ≥ 12)
- [ ] No secrets in source code or logs
- [ ] CORS, CSP, and security headers configured
- [ ] `npm audit` shows no critical/high vulnerabilities
- [ ] Rate limiting on authentication and sensitive endpoints
- [ ] Authorization checks on all protected resources
- [ ] No dangerous sinks from the catalog above in changed files
- [ ] `.omp/security-policy.md` created if project has org-specific rules
