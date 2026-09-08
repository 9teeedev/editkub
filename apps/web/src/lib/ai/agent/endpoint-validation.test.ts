import { describe, expect, test } from "bun:test";
import {
	DEFAULT_AGENT_BASE_URL,
	DEFAULT_AGENT_HOSTNAME,
	sanitizeConnectionError,
	validateAgentEndpoint,
} from "./endpoint-validation";

describe("validateAgentEndpoint", () => {
	test("default empty Base URL resolves to default provider hostname", () => {
		const emptyResult = validateAgentEndpoint("");
		expect(emptyResult.isValid).toBe(true);
		expect(emptyResult.hostname).toBe(DEFAULT_AGENT_HOSTNAME);
		expect(emptyResult.normalizedUrl).toBe(DEFAULT_AGENT_BASE_URL);
		expect(emptyResult.isCustom).toBe(false);

		const whitespaceResult = validateAgentEndpoint("   ");
		expect(whitespaceResult.isValid).toBe(true);
		expect(whitespaceResult.hostname).toBe(DEFAULT_AGENT_HOSTNAME);

		const undefinedResult = validateAgentEndpoint(undefined);
		expect(undefinedResult.isValid).toBe(true);
		expect(undefinedResult.hostname).toBe(DEFAULT_AGENT_HOSTNAME);
	});

	test("valid HTTPS endpoints are accepted", () => {
		const result = validateAgentEndpoint("https://api.openai.com/v1");
		expect(result.isValid).toBe(true);
		expect(result.hostname).toBe("api.openai.com");
		expect(result.isCustom).toBe(false);

		const customResult = validateAgentEndpoint("https://openrouter.ai/api/v1/");
		expect(customResult.isValid).toBe(true);
		expect(customResult.hostname).toBe("openrouter.ai");
		expect(customResult.normalizedUrl).toBe("https://openrouter.ai/api/v1");
		expect(customResult.isCustom).toBe(true);
	});

	test("HTTP localhost endpoints are accepted", () => {
		const localhostResult = validateAgentEndpoint("http://localhost:11434/v1");
		expect(localhostResult.isValid).toBe(true);
		expect(localhostResult.hostname).toBe("localhost");
		expect(localhostResult.isCustom).toBe(true);

		const ipResult = validateAgentEndpoint("http://127.0.0.1:8000/v1");
		expect(ipResult.isValid).toBe(true);
		expect(ipResult.hostname).toBe("127.0.0.1");

		const ipv6Result = validateAgentEndpoint("http://[::1]:11434/v1");
		expect(ipv6Result.isValid).toBe(true);
		expect(ipv6Result.hostname).toBe("[::1]");
	});

	test("remote HTTP endpoints are rejected", () => {
		const result = validateAgentEndpoint("http://api.remote-llm.com/v1");
		expect(result.isValid).toBe(false);
		expect(result.error).toBe("Remote endpoints must use HTTPS");
	});

	test("malformed endpoints are rejected", () => {
		const result1 = validateAgentEndpoint("not-a-valid-url");
		expect(result1.isValid).toBe(false);
		expect(result1.error).toBe("Invalid URL format");

		const result2 = validateAgentEndpoint("ftp://api.example.com");
		expect(result2.isValid).toBe(false);
		expect(result2.error).toBe("Invalid URL format");
	});
});

describe("sanitizeConnectionError", () => {
	test("sanitized connection errors never contain the supplied API key", () => {
		const apiKey = "sk-secret-test-key-999";
		const rawError = new Error(
			`Request failed for Authorization Bearer ${apiKey}: connection dropped`,
		);

		const result = sanitizeConnectionError(rawError, apiKey);
		expect(result.message).not.toContain(apiKey);
		expect(JSON.stringify(result)).not.toContain(apiKey);
	});

	test("maps 401/403 to Authentication failed", () => {
		const err401 = new Error("LLM API error (401): Incorrect API key provided");
		expect(sanitizeConnectionError(err401).state).toBe("auth_failed");
		expect(sanitizeConnectionError(err401).message).toBe(
			"Authentication failed",
		);

		const err403 = new Error("403 Forbidden");
		expect(sanitizeConnectionError(err403).state).toBe("auth_failed");
	});

	test("maps 404 to Model not found or unsupported", () => {
		const err404 = new Error(
			"LLM API error (404): The model gpt-xxx does not exist",
		);
		expect(sanitizeConnectionError(err404).state).toBe("model_not_found");
		expect(sanitizeConnectionError(err404).message).toBe(
			"Model not found or unsupported",
		);
	});

	test("maps provider 503 model_not_found bodies to Model not found, not unreachable", () => {
		// TokenRouter answers unknown models with 503 + model_not_found.
		const err503 = new Error(
			'LLM API error (503): {"error":{"code":"model_not_found","message":"No available channel for model glm-5.3 under group default"}}',
		);
		const result = sanitizeConnectionError(err503);
		expect(result.state).toBe("model_not_found");
		expect(result.message).toBe("Model not found or unsupported");
	});

	test("maps network failures to Endpoint unreachable", () => {
		const networkErr = new TypeError("Failed to fetch");
		expect(sanitizeConnectionError(networkErr).state).toBe("unreachable");
		expect(sanitizeConnectionError(networkErr).message).toBe(
			"Endpoint unreachable — this provider may not allow browser requests",
		);

		const err502 = new Error("502 Bad Gateway");
		expect(sanitizeConnectionError(err502).state).toBe("unreachable");
	});
});
