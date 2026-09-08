import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateUUID } from "@/utils/id";
import {
	type ExpertRoleId,
	DEFAULT_EXPERT_ROLE,
} from "@/lib/ai/agent/expert-roles";
import { runAgentLoop } from "@/lib/ai/agent/service";
import { DEFAULT_CONTEXT_WINDOW } from "@/lib/ai/agent/model-presets";
import {
	type ModelEntry,
	type ModelFetchStatus,
	fetchAvailableModels,
	mergeModelList,
} from "@/lib/ai/agent/model-list";
import type {
	AgentLLMConfig,
	AgentMessage,
	AgentStatus,
	PendingToolConfirmation,
} from "@/lib/ai/agent/types";
import {
	clearSessionSecret,
	getSessionSecret,
	setSessionSecret,
} from "@/lib/storage/session-secrets";
import { migrateLegacySecrets } from "@/lib/storage/legacy-secrets-migration";
import { validateAgentEndpoint } from "@/lib/ai/agent/endpoint-validation";

// Run legacy localStorage secret migration safely on startup
migrateLegacySecrets();

interface AgentPersistedConfig {
	baseUrl: string;
	model: string;
}

interface AgentPersistedState {
	config: AgentPersistedConfig;
	autoMode: boolean;
	isOpen: boolean;
	expertRole: ExpertRoleId;
	contextWindow: number;
	modelList: ModelEntry[];
}

interface AgentState {
	config: AgentLLMConfig;
	autoMode: boolean;
	isOpen: boolean;
	expertRole: ExpertRoleId;
	contextWindow: number;
	modelList: ModelEntry[];
	messages: AgentMessage[];
	status: AgentStatus;
	currentToolCall: string | null;
	pendingConfirmation: PendingToolConfirmation | null;
	streamingContent: string;
	contextTokens: number;
	modelFetchStatus: ModelFetchStatus;
	modelFetchError: string | null;

	initMessages: (messages: AgentMessage[]) => void;
	getMessages: () => AgentMessage[];
	togglePanel: () => void;
	sendMessage: (content: string) => Promise<void>;
	confirmToolCall: () => void;
	skipToolCall: () => void;
	cancel: () => void;
	clearMessages: () => void;
	setAutoMode: (enabled: boolean) => void;
	setConfig: (config: Partial<AgentLLMConfig>) => void;
	forgetApiKey: () => void;
	setExpertRole: (roleId: ExpertRoleId) => void;
	setContextWindow: (tokens: number) => void;
	fetchModels: () => Promise<void>;
	upsertModel: (entry: ModelEntry) => void;
	removeModel: (id: string) => void;
}

let abortController: AbortController | null = null;
let confirmationResolver: ((confirmed: boolean) => void) | null = null;

export const partializeAgentSettings = (
	state: AgentState,
): AgentPersistedState => ({
	config: {
		baseUrl: state.config.baseUrl,
		model: state.config.model,
	},
	autoMode: state.autoMode,
	isOpen: state.isOpen,
	expertRole: state.expertRole,
	contextWindow: state.contextWindow,
	modelList: state.modelList,
});

export const useAgentStore = create<AgentState>()(
	persist(
		(set, get) => ({
			config: {
				baseUrl: "",
				apiKey: getSessionSecret("agent-api-key"),
				model: "",
			},
			autoMode: false,
			isOpen: true,
			expertRole: DEFAULT_EXPERT_ROLE,
			contextWindow: DEFAULT_CONTEXT_WINDOW,
			modelList: [],
			messages: [],
			status: "idle" as AgentStatus,
			currentToolCall: null,
			pendingConfirmation: null,
			streamingContent: "",
			contextTokens: 0,
			modelFetchStatus: "idle" as ModelFetchStatus,
			modelFetchError: null,

			initMessages: (messages: AgentMessage[]) => {
				set({
					messages,
					status: "idle",
					currentToolCall: null,
					pendingConfirmation: null,
					streamingContent: "",
				});
			},

			getMessages: () => get().messages,

			togglePanel: () => {
				set((prev) => ({ isOpen: !prev.isOpen }));
			},

			sendMessage: async (content: string) => {
				const state = get();
				if (state.status !== "idle") return;
				const validation = validateAgentEndpoint(state.config.baseUrl);
				if (!validation.isValid) return;
				if (!state.config.apiKey) return;

				const userMessage: AgentMessage = {
					id: generateUUID(),
					role: "user",
					content,
					timestamp: Date.now(),
				};

				const currentMessages = [...state.messages, userMessage];
				set({
					messages: currentMessages,
					status: "thinking",
					streamingContent: "",
				});

				abortController = new AbortController();

				try {
					const updatedMessages = await runAgentLoop({
						config: state.config,
						messages: currentMessages,
						autoMode: state.autoMode,
						roleId: state.expertRole,
						signal: abortController.signal,
						callbacks: {
							onMessageStart: () => {
								set({ status: "thinking", streamingContent: "" });
							},
							onContentDelta: (delta) => {
								set((prev) => ({
									streamingContent: prev.streamingContent + delta,
								}));
							},
							onContentDone: () => {
								set({ streamingContent: "" });
							},
							onMessagesUpdated: (messages) => {
								set({ messages: [...messages] });
							},
							onContextUsage: ({ estimatedTokens }) => {
								set({ contextTokens: estimatedTokens });
							},
							onToolCallStart: (toolCall) => {
								set({
									status: "executing",
									currentToolCall: toolCall.name,
								});
							},
							onToolCallResult: (_toolCall) => {
								set({ currentToolCall: null });
							},
							onConfirmationRequired: (
								confirmation: PendingToolConfirmation,
							) => {
								return new Promise<boolean>((resolve) => {
									confirmationResolver = resolve;
									set({
										status: "awaiting-confirmation",
										pendingConfirmation: confirmation,
									});
								});
							},
							onDone: () => {},
							onError: (error) => {
								if (error.name !== "AbortError") {
									console.error("Agent error:", error);
								}
							},
						},
					});

					set({
						messages: updatedMessages,
						status: "idle",
						currentToolCall: null,
						pendingConfirmation: null,
						streamingContent: "",
					});
				} catch (error) {
					if (error instanceof Error && error.name === "AbortError") {
						set({ status: "idle", streamingContent: "" });
						return;
					}

					const errorMessage: AgentMessage = {
						id: generateUUID(),
						role: "assistant",
						content: `Error: ${error instanceof Error ? error.message : "Something went wrong"}`,
						timestamp: Date.now(),
					};

					set((prev) => ({
						messages: [...prev.messages, errorMessage],
						status: "error",
						streamingContent: "",
					}));
				} finally {
					abortController = null;
				}
			},

			confirmToolCall: () => {
				if (confirmationResolver) {
					confirmationResolver(true);
					confirmationResolver = null;
				}
				set({
					status: "executing",
					pendingConfirmation: null,
				});
			},

			skipToolCall: () => {
				if (confirmationResolver) {
					confirmationResolver(false);
					confirmationResolver = null;
				}
				set({
					status: "executing",
					pendingConfirmation: null,
				});
			},

			cancel: () => {
				if (abortController) {
					abortController.abort();
					abortController = null;
				}
				if (confirmationResolver) {
					confirmationResolver(false);
					confirmationResolver = null;
				}
				set({
					status: "idle",
					currentToolCall: null,
					pendingConfirmation: null,
					streamingContent: "",
				});
			},

			clearMessages: () => {
				set({ messages: [], status: "idle", streamingContent: "" });
			},

			setAutoMode: (enabled) => {
				set({ autoMode: enabled });
			},

			setConfig: (config) => {
				set((prev) => {
					const nextConfig = { ...prev.config, ...config };
					if ("apiKey" in config) {
						const key = config.apiKey ?? "";
						if (key.trim()) {
							setSessionSecret("agent-api-key", key.trim());
						} else {
							clearSessionSecret("agent-api-key");
						}
					}
					return {
						config: nextConfig,
					};
				});
			},

			forgetApiKey: () => {
				clearSessionSecret("agent-api-key");
				set((prev) => ({
					config: { ...prev.config, apiKey: "" },
				}));
			},

			setExpertRole: (roleId) => {
				set({ expertRole: roleId });
			},

			setContextWindow: (tokens) => {
				set({ contextWindow: tokens > 0 ? tokens : DEFAULT_CONTEXT_WINDOW });
			},

			fetchModels: async () => {
				const state = get();
				if (state.modelFetchStatus === "loading") return;
				const validation = validateAgentEndpoint(state.config.baseUrl);
				if (!validation.isValid) return;
				const { baseUrl, apiKey } = state.config;
				if (!apiKey) return;
				set({ modelFetchStatus: "loading", modelFetchError: null });
				try {
					const fetched = await fetchAvailableModels({ baseUrl, apiKey });
					set((prev) => ({
						modelList: mergeModelList({ current: prev.modelList, fetched }),
						modelFetchStatus: "idle",
					}));
				} catch (error) {
					set({
						modelFetchStatus: "error",
						modelFetchError:
							error instanceof Error ? error.message : "Failed to fetch models",
					});
				}
			},

			upsertModel: (entry) => {
				set((prev) => {
					const id = entry.id.trim();
					if (!id) return prev;
					const exists = prev.modelList.some((model) => model.id === id);
					return {
						modelList: exists
							? prev.modelList.map((model) =>
									model.id === id ? { ...model, ...entry, id } : model,
								)
							: [...prev.modelList, { ...entry, id }].sort((a, b) =>
									a.id.localeCompare(b.id),
								),
					};
				});
			},

			removeModel: (id) => {
				set((prev) => ({
					modelList: prev.modelList.filter((model) => model.id !== id),
				}));
			},
		}),
		{
			name: "agent-settings",
			partialize: partializeAgentSettings,
			merge: (persisted, current) => {
				const p = persisted as Partial<AgentPersistedState> | undefined;
				return {
					...(current as AgentState),
					...p,
					config: {
						...current.config,
						...(p?.config
							? { baseUrl: p.config.baseUrl, model: p.config.model }
							: {}),
						apiKey: current.config.apiKey,
					},
				};
			},
		},
	),
);
