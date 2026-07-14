import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { webEnv } from "@editkub/env/web";

let _db: ReturnType<typeof drizzle> | null = null;

function getDatabaseUrl() {
	if (!webEnv.DATABASE_URL) {
		throw new Error(
			"DATABASE_URL is required when database features are enabled.",
		);
	}

	return webEnv.DATABASE_URL;
}

export function getDb() {
	if (!_db) {
		const client = postgres(getDatabaseUrl());
		_db = drizzle(client, { schema });
	}

	return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
	get(_target, property, receiver) {
		return Reflect.get(getDb() as object, property, receiver);
	},
}) as ReturnType<typeof drizzle>;

export * from "./schema";
