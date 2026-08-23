# DokoSoko local integration environment

This Compose project runs the ComplicatedAuth side of the integration on localhost subdomains:

- Console: `http://console.complicatedauth.localhost:33000`
- OAuth issuer and integration API: `http://api.complicatedauth.localhost:38080`
- Mailpit: `http://localhost:38025`

It expects the DokoSoko API at `http://api.dokosoko.localhost:8080` and its widget host at `http://widget.dokosoko.localhost:34000`.

Start the stack without widget credentials while configuring OAuth and support delivery:

```sh
docker compose up -d --build
```

After creating the widget in DokoSoko's Web Interface, copy `.env.example` to the git-ignored `.env`, replace both values with the one-time widget result, and recreate only the console:

```sh
docker compose up -d --build console
```

The widget secret remains server-only. The browser calls the authenticated same-origin token route, which derives the ComplicatedAuth member and Tenant identifiers from the protected console session before creating a DokoSoko bootstrap.
