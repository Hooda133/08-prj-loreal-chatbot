// Security boundary regression tests. Use Node built-ins only; no live API
// calls, credentials or network dependencies are needed for this audit.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, extname } from "node:path";

const rootUrl = new URL("../", import.meta.url);
const root = fileURLToPath(rootUrl);
const load = path => readFileSync(new URL(path, rootUrl), "utf8");
const workerUrl = "https://loreal-beauty-advisor.elshamandy133.workers.dev";
const publicFiles = [
  "index.html", "script.js", "product-catalog.js", "routine-builder.js",
  "style.css", "routine-builder.css"
];

test("all browser-side chatbot API calls use the HTTPS Cloudflare Worker", () => {
  const source = load("script.js");
  assert.ok(source.includes('const WORKER_URL = "' + workerUrl + '"'));
  assert.match(source, /await\s+fetch\s*\(\s*WORKER_URL\s*,/);
  assert.match(source, /method:\s*"POST"/);
  assert.match(source, /body:\s*JSON\.stringify\(\{\s*messages:\s*nextMessages\s*\}\)/);
  // Never send bearer tokens or directly contact OpenAI from GitHub Pages.
  assert.doesNotMatch(source, /api\.openai\.com/i);
  assert.doesNotMatch(source, /\b(?:Authorization|Bearer)\b/i);
  for (const filename of publicFiles) {
    const content = load(filename);
    assert.doesNotMatch(content, /api\.openai\.com|OPENAI_API_KEY|sk-proj-/i,
      filename + " may not contain upstream OpenAI endpoints or secrets");
  }
});

test("the browser CSP permits only this website and the approved Worker for fetch", () => {
  const html = load("index.html");
  const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"\s*\/>/);
  assert.ok(policy, "Missing browser connect-src policy");
  assert.equal(policy[1], "connect-src 'self' " + workerUrl);
});

test("the Worker reads its secret from Cloudflare and validates incoming requests", () => {
  const worker = load("RESOURCE_cloudflare-worker.js");
  assert.match(worker, /env\.OPENAI_API_KEY/);
  assert.match(worker, /"Authorization":/);
  assert.match(worker, /fetch\("https:\/\/api\.openai\.com\/v1\/chat\/completions"/);
  assert.match(worker, /allowedOrigins\.includes\(origin\)/);
  assert.match(worker, /if \(!isAllowed\) return json\(\{ error: "Origin not allowed" \}, 403, cors\)/);
  assert.match(worker, /body\.messages\.length > 12/);
  assert.match(worker, /m\.content\.length > 1000/);
  assert.match(worker, /"Cache-Control": "no-store"/);
});

test("git ignores local credentials and private-key files", () => {
  const rules = load(".gitignore").split(/\r?\n/).map(line => line.trim());
  for (const item of [".env", ".env.*", ".dev.vars", ".dev.vars.*", "secrets.js", "*.pem", "*.key"]) {
    assert.ok(rules.includes(item), item + " must be ignored");
  }
});

test("no Git-tracked text file contains an obvious real credential or private key", () => {
  const names = execFileSync("git", ["ls-files", "-z"], {
    cwd: root, encoding: "utf8"
  }).split("\0").filter(Boolean);
  const keyPatterns = [
    /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bAIza[0-9A-Za-z_-]{30,}/
  ];
  for (const name of names) {
    if (![".js", ".mjs", ".html", ".css", ".md", ".json", ".yml", ".yaml", ".toml", ".txt"].includes(extname(name))) continue;
    const content = readFileSync(join(root, name), "utf8");
    for (const pattern of keyPatterns) {
      assert.doesNotMatch(content, pattern, "Potential credential in " + name);
    }
  }
});
