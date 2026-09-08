import { describe, expect, test } from "bun:test";
import { testAgentConnection } from "./test-connection";
import { useAgentStore } from "@/stores/agent-store";

describe("testAgentConnection", () => {
	test("connection test rejects invalid endpoint without network call", async () => {
		const result = await testAgentConnection({
			config: {
				baseUrl: "http://remote-insecure.com",
				apiKey: "sk-test",
				model: "gpt-4o",
			},
		});
		expect(result.state).toBe("invalid_endpoint");
		expect(result.message).toBe("Remote endpoints must use HTTPS");
	});

	test("connection test rejects missing API key", async () => {
		const result = await testAgentConnection({
			config: {
				baseUrl: "https://api.openai.com/v1",
				apiKey: "",
				model: "gpt-4o",
			},
		});
		expect(result.state).toBe("auth_failed");
		expect(result.message).toBe("Authentication failed");
	});

	test("connection test does not add messages to Agent project history", async () => {
		// Verify initial store messages
		const initialMessages = useAgentStore.getState().getMessages();

		// Run connection test
		await testAgentConnection({
			config: {
				baseUrl: "http://malformed-or-unreachable.invalid",
				apiKey: "sk-test",
				model: "gpt-4o",
			},
		});

		const currentMessages = useAgentStore.getState().getMessages();
		expect(currentMessages).toEqual(initialMessages);
		expect(currentMessages.length).toBe(initialMessages.length);
	});
});
