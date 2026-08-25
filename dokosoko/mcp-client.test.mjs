import assert from "node:assert/strict";
import test from "node:test";

import {MCP_PROTOCOL_VERSION, parseBearerResourceMetadata, redactCredentialResult} from "./mcp-client.mjs";

test("parses the exact protected-resource metadata URL", () => {
  assert.equal(parseBearerResourceMetadata('Bearer resource_metadata="http://localhost:8080/.well-known/oauth-protected-resource/mcp", scope="mcp:private"'), "http://localhost:8080/.well-known/oauth-protected-resource/mcp");
  assert.equal(MCP_PROTOCOL_VERSION, "2026-07-28");
  assert.throws(() => parseBearerResourceMetadata('Bearer scope="mcp:private"'));
});

test("redacts one-time credential material from the acceptance report", () => {
  const safe = redactCredentialResult({credential: {id: "credential-1", state: "active"}, credential_material: "ca_xk_test_never-print", environment_variable: "VOICE_API_KEY", existing: false});
  assert.equal(safe.credential_id, "credential-1");
  assert.match(safe.credential_material, /^<redacted:\d+-bytes>$/);
  assert.doesNotMatch(JSON.stringify(safe), /ca_xk_test_never-print/);
});
