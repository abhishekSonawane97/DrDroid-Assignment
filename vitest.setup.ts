import { existsSync } from "node:fs";

// Vitest (unlike `next dev`/`next build`) doesn't load .env.local
// automatically. Node's built-in loader keeps this dependency-free.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
