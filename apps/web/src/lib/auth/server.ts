import { betterAuth, type RateLimit } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Redis } from "@upstash/redis";
import { db } from "@/lib/db";
import { webEnv } from "@editkub/env/web";

function isAuthConfigured() {
	return Boolean(webEnv.DATABASE_URL && webEnv.BETTER_AUTH_SECRET);
}

function createAuth() {
	if (!isAuthConfigured()) {
		throw new Error(
			"Auth is disabled. Set DATABASE_URL and BETTER_AUTH_SECRET to enable auth.",
		);
	}

	const redisUrl = webEnv.UPSTASH_REDIS_REST_URL;
	const redisToken = webEnv.UPSTASH_REDIS_REST_TOKEN;

	if (!redisUrl || !redisToken) {
		throw new Error(
			"Auth requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
		);
	}

	const redis = new Redis({
		url: redisUrl,
		token: redisToken,
	});

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",
			usePlural: true,
		}),
		secret: webEnv.BETTER_AUTH_SECRET,
		user: {
			deleteUser: {
				enabled: true,
			},
		},
		emailAndPassword: {
			enabled: true,
		},
		rateLimit: {
			storage: "secondary-storage",
			customStorage: {
				get: async (key) => {
					const value = await redis.get(key);
					return value as RateLimit | undefined;
				},
				set: async (key, value) => {
					await redis.set(key, value);
				},
			},
		},
		baseURL: webEnv.NEXT_PUBLIC_SITE_URL,
		appName: "Editkub",
		trustedOrigins: [webEnv.NEXT_PUBLIC_SITE_URL],
	});
}

let authInstance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
	if (!authInstance) {
		authInstance = createAuth();
	}

	return authInstance;
}

export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
	get(_target, property, receiver) {
		return Reflect.get(getAuth() as object, property, receiver);
	},
}) as ReturnType<typeof betterAuth>;

export function isAuthEnabled() {
	return isAuthConfigured();
}

export type Auth = ReturnType<typeof getAuth>;
