# Integration security checklist

- Mount the BFF on the relying party's own HTTPS origin.
- Never expose `COMPLICATEDAUTH_SERVICE_CREDENTIAL`, `login_reference`, or
  `session_reference` to browser code.
- Use `RedisReferenceStore` or a custom shared TTL-backed store in production.
- Configure Redis authentication, TLS, eviction alerts, and environment-specific
  key prefixes.
- Deploy a restrictive Content Security Policy because browser tokens are bearer
  credentials.
- Do not log passwords, service credentials, browser tokens, WebAuthn payloads, or selfies.
- Configure exact allowed origins and verify the RP ID before enrollment.
- Handle `ComplicatedAuthError` by `kind` and `code`; do not expose internal
  provider messages directly to users.
- Exercise first-FIDO enrollment, restore, logout, revocation, expiry, and
  multi-instance continuity before launch.
