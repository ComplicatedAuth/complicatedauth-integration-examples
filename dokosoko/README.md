# DokoSoko local integration environment

This Compose project runs the ComplicatedAuth side of the integration on localhost subdomains:

- Console: `http://console.complicatedauth.localhost:33000`
- OAuth issuer and integration API: `http://api.complicatedauth.localhost:38080`
- Mailpit: `http://localhost:38025`

It expects the DokoSoko API at `http://api.dokosoko.localhost:8080` and its widget host at `http://widget.dokosoko.localhost:34000`.
Use the DokoSoko Web Interface at `http://localhost:8080` for every identity, support, API, tool, and widget configuration step. The `api.dokosoko.localhost` name is only the host-gateway alias used by the ComplicatedAuth console container; it is not a second administration surface.

Start the stack without widget credentials while configuring OAuth and support delivery:

```sh
docker compose up -d --build
```

After creating the widget in DokoSoko's Web Interface, copy `.env.example` to the git-ignored `.env`, replace both values with the one-time widget result, and recreate only the console:

```sh
docker compose up -d --build console
```

The widget secret remains server-only. The browser calls the authenticated same-origin token route, which derives the ComplicatedAuth member and Tenant identifiers from the protected console session before creating a DokoSoko bootstrap.

The complete provider-neutral contract, exact local values, security boundaries, and redacted Web Interface evidence are in the ComplicatedAuth documentation guide **External platform integrations**. The verified OAuth callback for this instance is `http://localhost:8080/oauth/callback`; the DokoSoko identity mapping uses `tenant_uid` and leaves the optional installation claim unconfigured.

## Standalone MCP acceptance client

The dependency-free Node client exercises the advertised protected-resource metadata, dynamic client registration, loopback OAuth with PKCE S256, Stateless MCPv2 discovery, resources, tools, and an invalid-schema negative case:

```sh
node dokosoko/mcp-client.mjs
```

To additionally verify the API Admin credential lifecycle, pass an explicit mutation attestation. The client prints the exact non-secret arguments before each confirmed call, retains OAuth and one-time credential material in memory only, redacts the material from its report, and revokes the issued credential before exit:

```sh
node dokosoko/mcp-client.mjs \
  --admin-lifecycle \
  --confirm-mutations \
  --environment-id local-test
```

Open the printed `AUTHORIZATION_URL` in the already signed-in test browser. Do not paste tokens or credentials into the terminal or configuration files.
