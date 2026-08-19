# ComplicatedAuth integration examples

Copy-ready server-route recipes for applications that expose the
ComplicatedAuth BFF protocol on their own origin.

| Framework | Recipe | Runtime |
| --- | --- | --- |
| Remix | [`remix/`](./remix/) | Node/Web-standard request handler |
| SvelteKit | [`sveltekit/`](./sveltekit/) | Node adapter |
| Next.js | [Dedicated example repository](https://github.com/ComplicatedAuth/complicatedauth-nextjs-example) | App Router |

Every production recipe uses `RedisReferenceStore`. Keep the Project API key
in a secret manager and set:

```text
COMPLICATEDAUTH_URL=https://your-auth-api.example
COMPLICATEDAUTH_PROJECT_UID=00000000-0000-0000-0000-000000000000
COMPLICATEDAUTH_API_KEY=<secret>
REDIS_URL=rediss://...
```

Run `npm run check` to verify that every supported recipe and its required
security markers are present. These examples intentionally omit UI so they can
pair with the framework-neutral `@complicatedauth/browser` package.

Read [`SECURITY.md`](./SECURITY.md) before deploying a recipe.
