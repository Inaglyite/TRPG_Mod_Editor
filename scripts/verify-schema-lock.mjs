import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaRoot = resolve(root, "schemas/trpgmod");
const lock = JSON.parse(await readFile(resolve(schemaRoot, "schema-lock.json"), "utf8"));
const failures = [];

for (const [name, expected] of Object.entries(lock.files)) {
  const content = await readFile(resolve(schemaRoot, name));
  const actual = createHash("sha256").update(content).digest("hex");
  if (actual !== expected) failures.push(`${name}: expected ${expected}, received ${actual}`);
}

if (failures.length) {
  throw new Error(`Schema lock verification failed:\n${failures.join("\n")}`);
}

console.log(`Verified ${Object.keys(lock.files).length} schemas from ${lock.commit}`);
