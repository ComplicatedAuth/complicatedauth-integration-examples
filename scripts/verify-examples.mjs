import {access, readFile} from "node:fs/promises";

const frameworkRecipes = [
  "remix/app/routes/auth.$.ts",
  "sveltekit/src/routes/auth/[...path]/+server.ts",
];
const required = [
  "README.md",
  "SECURITY.md",
  ...frameworkRecipes,
  "dokosoko/mcp-client.mjs",
  "dokosoko/mcp-client.test.mjs",
];
for (const file of required) await access(file);

for (const file of frameworkRecipes) {
  const source = await readFile(file, "utf8");
  for (const marker of ["ComplicatedAuthServer", "RedisReferenceStore", "COMPLICATEDAUTH_SERVICE_CREDENTIAL"]) {
    if (!source.includes(marker)) throw new Error(`${file} is missing ${marker}`);
  }
  if (/ca_sk_(?:test|live)_[A-Za-z0-9_-]+/.test(source)) throw new Error(`${file} contains a service-credential-shaped literal`);
}

console.log(`Verified ${frameworkRecipes.length} framework recipes, the standalone MCP client, and their security guidance.`);
