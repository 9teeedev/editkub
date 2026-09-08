import { describe, expect, test } from "bun:test";
import {
	AGENT_RELAY_ENDPOINT,
	isRelayTargetAllowed,
	RELAY_TARGET_HEADER,
	resolveAgentRequest,
} from "./relay";

describe("resolveAgentRequest", () => {
	test("passes the target URL through when relay is off", () => {
		const result = resolveAgentRequest(
			false,
			"https://api.openai.com/v1/chat/completions",
		);
		expect(result.url).toBe("https://api.openai.com/v1/chat/completions");
		expect(result.headers).toEqual({});
	});

	test("treats undefined relay as off (legacy configs)", () => {
		const result = resolveAgentRequest(
			undefined,
			"https://api.anthropic.com/v1/messages",
		);
		expect(result.url).toBe("https://api.anthropic.com/v1/messages");
		expect(result.headers).toEqual({});
	});

	test("routes to the relay endpoint with the target in a header", () => {
		const result = resolveAgentRequest(
			true,
			"https://api.tokenrouter.com/v1/chat/completions",
		);
		expect(result.url).toBe(AGENT_RELAY_ENDPOINT);
		expect(result.headers[RELAY_TARGET_HEADER]).toBe(
			"https://api.tokenrouter.com/v1/chat/completions",
		);
	});
});

describe("isRelayTargetAllowed", () => {
	test("allows https targets", () => {
		expect(isRelayTargetAllowed("https://api.tokenrouter.com/v1")).toBe(true);
		expect(isRelayTargetAllowed("https://api.openai.com/v1")).toBe(true);
	});

	test("allows http only for localhost", () => {
		expect(isRelayTargetAllowed("http://localhost:8080/v1")).toBe(true);
		expect(isRelayTargetAllowed("http://127.0.0.1:11434/v1")).toBe(true);
		expect(isRelayTargetAllowed("http://[::1]:11434/v1")).toBe(true);
		expect(isRelayTargetAllowed("http://myhost.dev/v1")).toBe(false);
	});

	test("blocks private and link-local IPv4 literals", () => {
		expect(isRelayTargetAllowed("http://192.168.1.10/v1")).toBe(false);
		expect(isRelayTargetAllowed("http://10.0.0.5/v1")).toBe(false);
		expect(isRelayTargetAllowed("http://172.16.0.1/v1")).toBe(false);
		expect(isRelayTargetAllowed("https://169.254.169.254/meta")).toBe(false);
		expect(isRelayTargetAllowed("http://0.0.0.0/v1")).toBe(false);
	});

	test("blocks non-http protocols and malformed URLs", () => {
		expect(isRelayTargetAllowed("ftp://api.example.com/v1")).toBe(false);
		expect(isRelayTargetAllowed("file:///etc/passwd")).toBe(false);
		expect(isRelayTargetAllowed("not a url")).toBe(false);
		expect(isRelayTargetAllowed("")).toBe(false);
	});
});
