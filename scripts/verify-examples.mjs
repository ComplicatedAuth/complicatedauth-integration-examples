import {access, readFile} from "node:fs/promises";

const required = [
  "README.md",
  "SECURITY.md",
  "remix/app/routes/auth.$.ts",
  "sveltekit/src/routes/auth/[...path]/+server.ts",
];
for (const file of required) await access(file);

for (const file of required.slice(2)) {
  const source = await readFile(file, "utf8");
  for (const marker of ["ComplicatedAuthServer", "RedisReferenceStore", "COMPLICATEDAUTH_API_KEY"]) {
    if (!source.includes(marker)) throw new Error(`${file} is missing ${marker}`);
  }
  if (/ca_pk_[A-Za-z0-9_-]+/.test(source)) throw new Error(`${file} contains an API-key-shaped literal`);
}

console.log(`Verified ${required.length - 2} framework recipes and their security guidance.`);
