# SvelteKit BFF route

Install `@complicatedauth/server` and `redis`, then copy the catch-all server
route. Use a Node adapter and initialize the Redis connection in a server-only
module for larger applications.

Browser code uses `new ComplicatedAuthClient({baseUrl: "/auth"})`.
