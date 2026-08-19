# Remix BFF route

Install `@complicatedauth/server` and `redis`, then copy
`app/routes/auth.$.ts`. Export the Redis connection from your application's
server-only module and keep the route on the Node runtime.

The splat route accepts GET, POST, and DELETE. Browser code uses
`new ComplicatedAuthClient({baseUrl: "/auth"})`.
