import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
import { webEnv } from "@editkub/env/web";

// Load the right env file based on environment
if (webEnv.NODE_ENV === "production") {
  dotenv.config({ path: ".env.production" });
} else {
  dotenv.config({ path: ".env.local" });
}

function getRequiredDatabaseUrl() {
  if (!webEnv.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for drizzle commands.");
  }

  return webEnv.DATABASE_URL;
}

export default {
  schema: "./src/schema.ts",
  dialect: "postgresql",
  migrations: {
    table: "drizzle_migrations",
  },
  dbCredentials: {
    url: getRequiredDatabaseUrl(),
  },
  out: "./migrations",
  strict: webEnv.NODE_ENV === "production",
} satisfies Config;
