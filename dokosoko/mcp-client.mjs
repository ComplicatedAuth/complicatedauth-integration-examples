#!/usr/bin/env node

import {createHash, randomBytes} from "node:crypto";
import {createServer} from "node:http";
import {pathToFileURL} from "node:url";

export const MCP_PROTOCOL_VERSION = "2026-07-28";

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

export function parseBearerResourceMetadata(header) {
  const match = String(header ?? "").match(/\bresource_metadata="([^"]+)"/i);
  if (!match) throw new Error("MCP challenge did not advertise protected-resource metadata");
  return match[1];
}

export function redactCredentialResult(value) {
  if (!value || typeof value !== "object") throw new Error("Credential tool returned no structured result");
  const credential = value.credential;
  const material = value.credential_material;
  if (!credential?.id || material === undefined || material === null) {
    throw new Error("Credential tool did not return a credential ID and one-time material");
  }
  const encoded = typeof material === "string" ? material : JSON.stringify(material);
  return {
    credential_id: credential.id,
    state: credential.state,
    expires_at: credential.expires_at ?? null,
    environment_variable: value.environment_variable ?? null,
    credential_material: `<redacted:${Buffer.byteLength(encoded, "utf8")}-bytes>`,
    existing_idempotent_result: Boolean(value.existing),
  };
}

function argumentsFrom(argv) {
  const result = {
    baseURL: "http://localhost:8080",
    family: "complicatedauth-customer-api",
    environmentID: "local-test",
    idempotencyKey: "",
    adminLifecycle: false,
    confirmMutations: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--base-url") result.baseURL = argv[++index];
    else if (argument === "--family") result.family = argv[++index];
    else if (argument === "--environment-id") result.environmentID = argv[++index];
    else if (argument === "--idempotency-key") result.idempotencyKey = argv[++index];
    else if (argument === "--admin-lifecycle") result.adminLifecycle = true;
    else if (argument === "--confirm-mutations") result.confirmMutations = true;
    else if (argument === "--help") result.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  result.baseURL = new URL(result.baseURL).origin;
  if (result.adminLifecycle && !result.confirmMutations) {
    throw new Error("--admin-lifecycle requires --confirm-mutations");
  }
  if (result.idempotencyKey && result.idempotencyKey.length < 16) {
    throw new Error("--idempotency-key must contain at least 16 characters");
  }
  return result;
}

async function responseJSON(response, label) {
  const text = await response.text();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON status ${response.status}`);
  }
  if (!response.ok) {
    const message = value?.error?.message ?? value?.error_description ?? text;
    throw new Error(`${label} failed (${response.status}): ${message}`);
  }
  return value;
}

async function discoverOAuth(baseURL) {
  const resource = `${baseURL}/mcp`;
  const challenge = await fetch(resource, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
      "Mcp-Method": "server/discover",
    },
    body: JSON.stringify({jsonrpc: "2.0", id: 0, method: "server/discover", params: {_meta: {"io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION}}}),
  });
  if (challenge.status !== 401) throw new Error(`Unauthenticated MCP challenge returned ${challenge.status}, expected 401`);
  const resourceMetadataURL = parseBearerResourceMetadata(challenge.headers.get("www-authenticate"));
  const protectedResource = await responseJSON(await fetch(resourceMetadataURL), "Protected-resource metadata");
  if (protectedResource.resource !== resource || protectedResource.authorization_servers?.length !== 1) {
    throw new Error("Protected-resource metadata is not bound to the exact MCP endpoint");
  }
  const authorizationServer = new URL(protectedResource.authorization_servers[0]).origin;
  const metadataURL = `${authorizationServer}/.well-known/oauth-authorization-server`;
  const authorizationMetadata = await responseJSON(await fetch(metadataURL), "Authorization-server metadata");
  return {resource, resourceMetadataURL, protectedResource, authorizationMetadata};
}

async function listenForAuthorizationCode(expectedState) {
  let resolveCode;
  let rejectCode;
  const codePromise = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    if (url.pathname !== "/callback") {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }
    if (url.searchParams.get("state") !== expectedState || !url.searchParams.get("code")) {
      response.statusCode = 400;
      response.end("Authorization response was invalid. You can close this tab.");
      rejectCode(new Error(url.searchParams.get("error_description") ?? "OAuth callback was invalid"));
      return;
    }
    response.end("DokoSoko MCP authorization completed. You can close this tab.");
    resolveCode(url.searchParams.get("code"));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {server, codePromise, redirectURI: `http://127.0.0.1:${address.port}/callback`};
}

async function authorize(discovery) {
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(24));
  const callback = await listenForAuthorizationCode(state);
  try {
    const registration = await responseJSON(await fetch(discovery.authorizationMetadata.registration_endpoint, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        client_name: "ComplicatedAuth DokoSoko acceptance client",
        redirect_uris: [callback.redirectURI],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
        scope: "mcp:private",
      }),
    }), "Dynamic client registration");
    const authorizationURL = new URL(discovery.authorizationMetadata.authorization_endpoint);
    authorizationURL.search = new URLSearchParams({
      response_type: "code",
      client_id: registration.client_id,
      redirect_uri: callback.redirectURI,
      code_challenge: challenge,
      code_challenge_method: "S256",
      scope: "mcp:private",
      resource: discovery.resource,
      state,
    }).toString();
    console.log(`AUTHORIZATION_URL=${authorizationURL}`);
    console.log("Open that URL in the signed-in browser; the client keeps the resulting token in memory only.");
    const code = await callback.codePromise;
    const token = await responseJSON(await fetch(discovery.authorizationMetadata.token_endpoint, {
      method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: registration.client_id,
        redirect_uri: callback.redirectURI,
        code_verifier: verifier,
        resource: discovery.resource,
      }),
    }), "OAuth token exchange");
    if (!token.access_token) throw new Error("OAuth token response did not contain an access token");
    return {accessToken: token.access_token, clientID: registration.client_id};
  } finally {
    callback.server.close();
  }
}

function mcpClient(resource, accessToken) {
  let nextID = 1;
  return async function call(method, params = {}) {
    const id = nextID++;
    const finalParams = {...params, _meta: {...params._meta, "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION}};
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
      "Mcp-Method": method,
    };
    if (method === "tools/call") headers["Mcp-Name"] = finalParams.name;
    const response = await fetch(resource, {method: "POST", headers, body: JSON.stringify({jsonrpc: "2.0", id, method, params: finalParams})});
    return responseJSON(response, `MCP ${method}`);
  };
}

async function confirmedToolCall(call, name, args, idempotencyKey, confirmationAllowed) {
  const params = {name, arguments: args, _meta: {idempotency_key: idempotencyKey}};
  const challenge = await call("tools/call", params);
  if (challenge.error?.code !== -32003 || !challenge.error?.data?.confirmation_challenge) {
    throw new Error(`${name} did not return the expected one-time confirmation challenge: ${JSON.stringify({code: challenge.error?.code, message: challenge.error?.message, data: challenge.error?.data})}`);
  }
  if (!confirmationAllowed) throw new Error(`${name} requires --confirm-mutations`);
  console.log(`CONFIRMED_MUTATION=${JSON.stringify({tool: name, arguments: args, idempotency_key: idempotencyKey || null})}`);
  const confirmed = await call("tools/call", {
    ...params,
    _meta: {...params._meta, confirmed: true, confirmation_challenge: challenge.error.data.confirmation_challenge},
  });
  if (confirmed.error) throw new Error(`${name} failed after confirmation: ${confirmed.error.message}`);
  return confirmed.result?.structuredContent;
}

async function run(options) {
  const discovery = await discoverOAuth(options.baseURL);
  const authorization = await authorize(discovery);
  const call = mcpClient(discovery.resource, authorization.accessToken);
  const server = await call("server/discover");
  const resources = await call("resources/list");
  const resourceItems = resources.result?.resources ?? [];
  const recipeResource = resourceItems.find((item) => String(item.uri ?? "").includes("connect-complicatedauth-customer-api-through-dokosoko-mcp")) ?? resourceItems[0];
  if (!recipeResource?.uri) throw new Error("MCP resources/list did not expose a published implementation recipe");
  const resourceRead = await call("resources/read", {uri: recipeResource.uri});
  const recipeContent = resourceRead.result?.contents?.[0];
  if (resourceRead.error || recipeContent?.mimeType !== "text/markdown" || !String(recipeContent?.text ?? "").includes("## Implementation")) {
    throw new Error("Published recipe resource could not be read as implementation Markdown");
  }
  const toolList = await call("tools/list");
  const tools = toolList.result?.tools ?? [];
  const names = tools.map((tool) => tool.name);
  const knowledgeName = `${options.family}.knowledge.search`;
  const invalid = await call("tools/call", {name: knowledgeName, arguments: {}});
  if (invalid.error?.code !== -32602) throw new Error("Invalid-schema negative test did not fail with JSON-RPC -32602");

  const report = {
    transport: {endpoint: discovery.resource, protocol: MCP_PROTOCOL_VERSION, resource_metadata: discovery.resourceMetadataURL},
    oauth: {issuer: discovery.authorizationMetadata.issuer, dynamic_client_registration: true, pkce: "S256", client_id: authorization.clientID},
    discovery: {manifest_hash: server.result?.manifestHash ?? null, catalog_revision: server.result?.catalogRevision ?? null},
    resources: {count: resourceItems.length, read: {uri: recipeResource.uri, title: recipeResource.title ?? recipeResource.name, mime_type: recipeContent.mimeType, passed: true}},
    tools: {count: tools.length, names},
    negative_schema_test: {tool: knowledgeName, jsonrpc_code: invalid.error.code, passed: true},
  };

  if (options.adminLifecycle) {
    const prefix = `${options.family}.admin.credentials`;
    for (const name of [`${prefix}.list`, `${prefix}.rotate`, `${prefix}.revoke`]) {
      if (!names.includes(name)) throw new Error(`Required API Admin tool is missing: ${name}`);
    }
    const before = await call("tools/call", {name: `${prefix}.list`, arguments: {}});
    if (before.error) throw new Error(`Credential list failed: ${before.error.message}`);
    const idempotencyKey = options.idempotencyKey || `complicatedauth-acceptance-${base64url(randomBytes(18))}`;
    const issued = await confirmedToolCall(call, `${prefix}.rotate`, {environment_id: options.environmentID, scopes: []}, idempotencyKey, options.confirmMutations);
    const safeIssued = redactCredentialResult(issued);
    const afterIssue = await call("tools/call", {name: `${prefix}.list`, arguments: {}});
    if (afterIssue.error) throw new Error(`Credential list after issuance failed: ${afterIssue.error.message}`);
    const revoked = await confirmedToolCall(call, `${prefix}.revoke`, {credential_id: safeIssued.credential_id}, "", options.confirmMutations);
    const afterRevoke = await call("tools/call", {name: `${prefix}.list`, arguments: {}});
    if (afterRevoke.error) throw new Error(`Credential list after revocation failed: ${afterRevoke.error.message}`);
    report.api_admin = {
      list_before_count: before.result?.structuredContent?.credentials?.length ?? 0,
      issued: safeIssued,
      list_after_issue_count: afterIssue.result?.structuredContent?.credentials?.length ?? 0,
      revoked: {credential_id: revoked?.id ?? safeIssued.credential_id, state: revoked?.state ?? null},
      list_after_revoke_count: afterRevoke.result?.structuredContent?.credentials?.length ?? 0,
    };
  }
  console.log(`ACCEPTANCE_REPORT=${JSON.stringify(report, null, 2)}`);
}

function help() {
  console.log(`Usage: node dokosoko/mcp-client.mjs [options]

Options:
  --base-url URL            DokoSoko origin (default http://localhost:8080)
  --family KEY              Published API family key
  --environment-id ID       Provider environment identifier used for issuance
  --idempotency-key KEY     Reuse an exact issuance request after a lost response
  --admin-lifecycle         Issue, list, and revoke one API credential
  --confirm-mutations       Attest to the two exact previews printed by the client
  --help                    Show this help

Tokens and one-time credential material remain in memory and are never written or printed.`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const options = argumentsFrom(process.argv.slice(2));
  if (options.help) help();
  else await run(options);
}
