import {
    type AgentRuntimeAgent,
    type AgentRuntimeAgentActivityList,
    type AgentRuntimeAgentEngineConfigSnapshot,
    type AgentRuntimeAgentEnv,
    type AgentRuntimeAgentFileContent,
    type AgentRuntimeAgentFileList,
    type AgentRuntimeAgentInbox,
    type AgentRuntimeAgentPresenceList,
    type AgentRuntimeAgentStopResult,
    type AgentRuntimeApplyAgentEngineConfig,
    type AgentRuntimeArchiveAgent,
    type AgentRuntimeArchiveBinding,
    type AgentRuntimeBinding,
    type AgentRuntimeBrowserActionResult,
    type AgentRuntimeBrowserSettings,
    type AgentRuntimeCancelModelProviderOAuth,
    type AgentRuntimeCapabilityHealth,
    type AgentRuntimeCapabilityHealthId,
    type AgentRuntimeCapabilityHealthList,
    type AgentRuntimeChat,
    type AgentRuntimeChatPaneState,
    type AgentRuntimeCreateAgent,
    type AgentRuntimeCreateMessage,
    type AgentRuntimeCurrentAgentSessionResult,
    type AgentRuntimeDeleteDiscordBinding,
    type AgentRuntimeDiscordBinding,
    type AgentRuntimeEventList,
    type AgentRuntimeHostToolList,
    type AgentRuntimeJobDetail,
    type AgentRuntimeJobList,
    type AgentRuntimeJobSlug,
    type AgentRuntimeMacAppList,
    type AgentRuntimeMcpAgentToolGrantList,
    type AgentRuntimeMcpConnection,
    type AgentRuntimeMcpConnectionCreate,
    type AgentRuntimeMcpConnectionList,
    type AgentRuntimeMcpConnectionTestResult,
    type AgentRuntimeMcpConnectionUpdate,
    type AgentRuntimeMcpDisconnectResult,
    type AgentRuntimeMcpOAuthComplete,
    type AgentRuntimeMcpOAuthStart,
    type AgentRuntimeMcpOAuthStartResult,
    type AgentRuntimeMcpPresetAccountCreate,
    type AgentRuntimeMcpToolList,
    type AgentRuntimeMessageAccepted,
    type AgentRuntimeModelAccess,
    type AgentRuntimeModelCapabilitySelectionSettings,
    type AgentRuntimeModelCategorySettings,
    type AgentRuntimeModelProviderCatalog,
    type AgentRuntimeModelProviderCatalogEntry,
    type AgentRuntimeModelProviderEnabled,
    type AgentRuntimeModels,
    type AgentRuntimeOpenAiSettings,
    type AgentRuntimeOpenRouterSettings,
    type AgentRuntimePollModelProviderOAuth,
    type AgentRuntimeRenderedWorkspaceInstructions,
    type AgentRuntimeResetAgentSession,
    type AgentRuntimeResetAgentSessionResult,
    type AgentRuntimeRestartAgentResult,
    type AgentRuntimeRunJob,
    type AgentRuntimeRunJobInput,
    type AgentRuntimeSaveAgentEnv,
    type AgentRuntimeSaveAgentEnvResult,
    type AgentRuntimeSaveAgentFile,
    type AgentRuntimeSaveBrowserSettings,
    type AgentRuntimeSaveDiscordBinding,
    type AgentRuntimeSaveModelCapabilitySelections,
    type AgentRuntimeSaveModelCategorySettings,
    type AgentRuntimeSaveModelCategorySettingsResult,
    type AgentRuntimeSaveModelProviderApiKey,
    type AgentRuntimeSaveOpenAiSettings,
    type AgentRuntimeSaveOpenRouterSettings,
    type AgentRuntimeSaveTimezoneSettings,
    type AgentRuntimeSaveTimezoneSettingsResult,
    type AgentRuntimeSaveWorkspaceInstructions,
    type AgentRuntimeSessionGraph,
    type AgentRuntimeSessionList,
    type AgentRuntimeSessionMessageList,
    type AgentRuntimeSessionPreviewList,
    type AgentRuntimeSessionPrompt,
    type AgentRuntimeSessionResync,
    type AgentRuntimeSetChatPaneStateRequest,
    type AgentRuntimeSetChatPaneStateResult,
    type AgentRuntimeSkill,
    type AgentRuntimeSkillHubActionResult,
    type AgentRuntimeSkillHubAvailable,
    type AgentRuntimeSkillHubInstallInput,
    type AgentRuntimeSkillHubPreview,
    type AgentRuntimeSkillHubScan,
    type AgentRuntimeSkillHubTap,
    type AgentRuntimeSkillHubTapList,
    type AgentRuntimeSkillHubUninstallInput,
    type AgentRuntimeSkillResetResult,
    type AgentRuntimeSkillSummary,
    type AgentRuntimeStartModelProviderOAuth,
    type AgentRuntimeStopTurn,
    type AgentRuntimeStopTurnResult,
    type AgentRuntimeSubmitModelProviderOAuth,
    type AgentRuntimeTimezoneSettings,
    type AgentRuntimeTool,
    type AgentRuntimeToolConfig,
    type AgentRuntimeToolEnvUpdate,
    type AgentRuntimeToolEnvUpdateResult,
    type AgentRuntimeToolList,
    type AgentRuntimeToolPostSetup,
    type AgentRuntimeToolProviderSelect,
    type AgentRuntimeToolProviderSelectResult,
    type AgentRuntimeUpdate,
    type AgentRuntimeUpdateAgentBio,
    type AgentRuntimeUpdateAgentModel,
    type AgentRuntimeUpdateAgentName,
    type AgentRuntimeUpdateAgentThinkingDefault,
    type AgentRuntimeUpdateAgentWebSettings,
    type AgentRuntimeUpdateModelProvider,
    type AgentRuntimeUpdateSkillEnabled,
    type AgentRuntimeUpdateToolEnabled,
    type AgentRuntimeUpsertBinding,
    type AgentRuntimeWorkspaceFileContent,
    type AgentRuntimeWorkspaceFileList,
    type AgentRuntimeWorkspaceFileListInput,
    type AgentRuntimeWorkspaceInstructions,
    agentRuntimeAgentActivityListSchema,
    agentRuntimeAgentEngineConfigSnapshotSchema,
    agentRuntimeAgentEnvSchema,
    agentRuntimeAgentFileContentSchema,
    agentRuntimeAgentFileListSchema,
    agentRuntimeAgentInboxSchema,
    agentRuntimeAgentListSchema,
    agentRuntimeAgentPresenceListSchema,
    agentRuntimeAgentSchema,
    agentRuntimeAgentStopResultSchema,
    agentRuntimeApplyAgentEngineConfigSchema,
    agentRuntimeArchiveAgentSchema,
    agentRuntimeArchiveBindingSchema,
    agentRuntimeBindingListSchema,
    agentRuntimeBindingSchema,
    agentRuntimeBrowserActionResultSchema,
    agentRuntimeBrowserSettingsSchema,
    agentRuntimeCancelModelProviderOAuthSchema,
    agentRuntimeCapabilityHealthIdSchema,
    agentRuntimeCapabilityHealthListSchema,
    agentRuntimeCapabilityHealthSchema,
    agentRuntimeChatListSchema,
    agentRuntimeChatPaneStateSchema,
    agentRuntimeCreateAgentSchema,
    agentRuntimeCreateMessageSchema,
    agentRuntimeCurrentAgentSessionResultSchema,
    agentRuntimeDeleteDiscordBindingSchema,
    agentRuntimeDiscordBindingListSchema,
    agentRuntimeErrorSchema,
    agentRuntimeHostToolListSchema,
    agentRuntimeJobDetailSchema,
    agentRuntimeJobListSchema,
    agentRuntimeJobSlugSchema,
    agentRuntimeMacAppListSchema,
    agentRuntimeMcpAgentToolGrantListSchema,
    agentRuntimeMcpConnectionCreateSchema,
    agentRuntimeMcpConnectionListSchema,
    agentRuntimeMcpConnectionSchema,
    agentRuntimeMcpConnectionTestResultSchema,
    agentRuntimeMcpConnectionUpdateSchema,
    agentRuntimeMcpDisconnectResultSchema,
    agentRuntimeMcpOAuthCompleteSchema,
    agentRuntimeMcpOAuthStartResultSchema,
    agentRuntimeMcpOAuthStartSchema,
    agentRuntimeMcpPresetAccountCreateSchema,
    agentRuntimeMcpToolListSchema,
    agentRuntimeMessageAcceptedSchema,
    agentRuntimeModelAccessSchema,
    agentRuntimeModelCapabilitySelectionSettingsSchema,
    agentRuntimeModelCategorySettingsSchema,
    agentRuntimeModelProviderCatalogEntrySchema,
    agentRuntimeModelProviderCatalogSchema,
    agentRuntimeModelProviderEnabledSchema,
    agentRuntimeModelProviderOAuthCancelSchema,
    agentRuntimeModelProviderOAuthPollSchema,
    agentRuntimeModelProviderOAuthStartSchema,
    agentRuntimeModelProviderOAuthSubmitSchema,
    agentRuntimeModelsSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeOpenAiSettingsSchema,
    agentRuntimeOpenRouterSettingsSchema,
    agentRuntimePollModelProviderOAuthSchema,
    agentRuntimeRenderedWorkspaceInstructionsSchema,
    agentRuntimeResetAgentSessionResultSchema,
    agentRuntimeResetAgentSessionSchema,
    agentRuntimeRestartAgentResultSchema,
    agentRuntimeRoutes,
    agentRuntimeRunJobInputSchema,
    agentRuntimeRunJobSchema,
    agentRuntimeSaveAgentEnvResultSchema,
    agentRuntimeSaveAgentEnvSchema,
    agentRuntimeSaveAgentFileSchema,
    agentRuntimeSaveBrowserSettingsSchema,
    agentRuntimeSaveDiscordBindingSchema,
    agentRuntimeSaveModelCapabilitySelectionsSchema,
    agentRuntimeSaveModelCategorySettingsResultSchema,
    agentRuntimeSaveModelCategorySettingsSchema,
    agentRuntimeSaveModelProviderApiKeySchema,
    agentRuntimeSaveOpenAiSettingsSchema,
    agentRuntimeSaveOpenRouterSettingsSchema,
    agentRuntimeSaveTimezoneSettingsResultSchema,
    agentRuntimeSaveTimezoneSettingsSchema,
    agentRuntimeSaveWorkspaceInstructionsSchema,
    agentRuntimeSessionGraphSchema,
    agentRuntimeSessionListSchema,
    agentRuntimeSessionMessageListSchema,
    agentRuntimeSessionPreviewListSchema,
    agentRuntimeSessionPromptSchema,
    agentRuntimeSessionResyncSchema,
    agentRuntimeSetChatPaneStateRequestSchema,
    agentRuntimeSetChatPaneStateResultSchema,
    agentRuntimeSkillHubActionResultSchema,
    agentRuntimeSkillHubAvailableSchema,
    agentRuntimeSkillHubInstallInputSchema,
    agentRuntimeSkillHubPreviewSchema,
    agentRuntimeSkillHubScanSchema,
    agentRuntimeSkillHubTapListSchema,
    agentRuntimeSkillHubTapSchema,
    agentRuntimeSkillHubUninstallInputSchema,
    agentRuntimeSkillListSchema,
    agentRuntimeSkillResetResultSchema,
    agentRuntimeSkillSchema,
    agentRuntimeStartModelProviderOAuthSchema,
    agentRuntimeStopTurnResultSchema,
    agentRuntimeStopTurnSchema,
    agentRuntimeSubmitModelProviderOAuthSchema,
    agentRuntimeTimezoneSettingsSchema,
    agentRuntimeToolConfigSchema,
    agentRuntimeToolEnvUpdateResultSchema,
    agentRuntimeToolEnvUpdateSchema,
    agentRuntimeToolListSchema,
    agentRuntimeToolPostSetupSchema,
    agentRuntimeToolProviderSelectResultSchema,
    agentRuntimeToolProviderSelectSchema,
    agentRuntimeToolSchema,
    agentRuntimeUpdateAgentBioSchema,
    agentRuntimeUpdateAgentModelSchema,
    agentRuntimeUpdateAgentNameSchema,
    agentRuntimeUpdateAgentThinkingDefaultSchema,
    agentRuntimeUpdateAgentWebSettingsSchema,
    agentRuntimeUpdateModelProviderSchema,
    agentRuntimeUpdateSchema,
    agentRuntimeUpdateSkillEnabledSchema,
    agentRuntimeUpdateToolEnabledSchema,
    agentRuntimeUpsertBindingSchema,
    agentRuntimeWorkspaceFileContentSchema,
    agentRuntimeWorkspaceFileListInputSchema,
    agentRuntimeWorkspaceFileListSchema,
    agentRuntimeWorkspaceInstructionsSchema,
    type RuntimeIdentityMe,
    type RuntimeIdentityMutationResult,
    type RuntimeInviteCreateResult,
    type RuntimeInviteList,
    type RuntimeMemberList,
    runtimeEventListSchema,
    runtimeIdentityMeSchema,
    runtimeIdentityMutationResultSchema,
    runtimeInviteCreateResultSchema,
    runtimeInviteListSchema,
    runtimeMemberListSchema,
} from '@tavern/api';
import { z } from 'zod';

const agentRuntimeClientOptionsSchema = z.object({
    baseUrl: z.string().url(),
    token: z.string().trim().min(1).optional(),
});

export class AgentRuntimeRequestError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    readonly status: number;

    constructor(input: { code: string; message: string; retryable: boolean; status: number }) {
        super(input.message);
        this.name = 'AgentRuntimeRequestError';
        this.code = input.code;
        this.retryable = input.retryable;
        this.status = input.status;
    }
}

export interface TavernAgentRuntimeClient {
    addMcpConnection(input: AgentRuntimeMcpConnectionCreate): Promise<AgentRuntimeMcpConnection>;
    addMcpPresetAccount(
        input: AgentRuntimeMcpPresetAccountCreate
    ): Promise<AgentRuntimeMcpConnection>;
    addSkillHubTap(input: AgentRuntimeSkillHubTap): Promise<AgentRuntimeSkillHubTapList>;
    applyAgentEngineConfig(
        input: AgentRuntimeApplyAgentEngineConfig
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    cancelModelProviderOAuth(input: AgentRuntimeCancelModelProviderOAuth): Promise<unknown>;
    close(): void;
    completeMcpConnectionOAuth(
        connectionId: string,
        input: AgentRuntimeMcpOAuthComplete
    ): Promise<AgentRuntimeMcpConnection>;
    createIdentityInvite(): Promise<RuntimeInviteCreateResult>;
    deleteAgent(agentId: string): Promise<AgentRuntimeArchiveAgent>;
    deleteBinding(bindingId: string): Promise<AgentRuntimeArchiveBinding>;
    deleteDiscordBinding(
        bindingId: string,
        input: AgentRuntimeDeleteDiscordBinding
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    deleteIdentityInvite(inviteId: string): Promise<RuntimeIdentityMutationResult>;
    deleteMcpConnection(connectionId: string): Promise<AgentRuntimeMcpDisconnectResult>;
    deleteOpenAiSettings(): Promise<AgentRuntimeOpenAiSettings>;
    deleteOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    disconnectMcpConnection(connectionId: string): Promise<AgentRuntimeMcpDisconnectResult>;
    getAgentConfig(agentId: string): Promise<AgentRuntimeAgent>;
    getAgentEngineConfig(): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    getAgentEnv(): Promise<AgentRuntimeAgentEnv>;
    getAgentFile(agentId: string, path: string): Promise<AgentRuntimeAgentFileContent>;
    getAgentInbox(agentId: string): Promise<AgentRuntimeAgentInbox>;
    getBrowserSettings(): Promise<AgentRuntimeBrowserSettings>;
    getCapability(id: AgentRuntimeCapabilityHealthId): Promise<AgentRuntimeCapabilityHealth>;
    getChatPaneState(chatId: string): Promise<AgentRuntimeChatPaneState>;
    getCurrentAgentSession(input: {
        agentId?: string;
        chatId: string;
    }): Promise<AgentRuntimeCurrentAgentSessionResult>;
    getIdentityMe(userSessionToken: string): Promise<RuntimeIdentityMe>;
    getModelAccess(): Promise<AgentRuntimeModelAccess>;
    getModelCapabilitySelections(): Promise<AgentRuntimeModelCapabilitySelectionSettings>;
    getModelCategorySettings(): Promise<AgentRuntimeModelCategorySettings>;
    getModelProviderCatalog(): Promise<AgentRuntimeModelProviderCatalog>;
    getModelProvidersEnabled(): Promise<AgentRuntimeModelProviderEnabled>;
    getModels(): Promise<AgentRuntimeModels>;
    getOpenAiSettings(): Promise<AgentRuntimeOpenAiSettings>;
    getOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    getRuntimeJob(slug: AgentRuntimeJobSlug): Promise<AgentRuntimeJobDetail | null>;
    getSessionGraph(sessionKey: string): Promise<AgentRuntimeSessionGraph>;
    getSessionPrompt(sessionKey: string): Promise<AgentRuntimeSessionPrompt | null>;
    getSkill(skillId: string): Promise<AgentRuntimeSkill>;
    getSkillHubAvailable(): Promise<AgentRuntimeSkillHubAvailable>;
    getTimezoneSettings(): Promise<AgentRuntimeTimezoneSettings>;
    getToolConfig(toolId: string): Promise<AgentRuntimeToolConfig>;
    getUpdateStatus(): Promise<AgentRuntimeUpdate>;
    getWorkspaceFile(agentId: string, path: string): Promise<AgentRuntimeWorkspaceFileContent>;
    getWorkspaceInstructions(agentId: string): Promise<AgentRuntimeRenderedWorkspaceInstructions>;
    installSkillHubSkill(
        input: AgentRuntimeSkillHubInstallInput
    ): Promise<AgentRuntimeSkillHubActionResult>;
    listAgentActivity(agentId: string, limit?: number): Promise<AgentRuntimeAgentActivityList>;
    listAgentFiles(agentId: string): Promise<AgentRuntimeAgentFileList>;
    listAgentPresence(): Promise<AgentRuntimeAgentPresenceList>;
    listAgents(): Promise<{ agents: AgentRuntimeAgent[] }>;
    listBindings(): Promise<{ bindings: AgentRuntimeBinding[] }>;
    listCapabilities(): Promise<AgentRuntimeCapabilityHealthList>;
    listChats(): Promise<{ chats: AgentRuntimeChat[] }>;
    listDiscordBindings(): Promise<{ bindings: AgentRuntimeDiscordBinding[] }>;
    listEvents(input?: AgentRuntimeListEventsInput): Promise<AgentRuntimeEventList>;
    listIdentityInvites(): Promise<RuntimeInviteList>;
    listIdentityMembers(): Promise<RuntimeMemberList>;
    listMacApps(options?: { limit?: number; query?: string }): Promise<AgentRuntimeMacAppList>;
    listMcpAgentGrants(agentId: string): Promise<AgentRuntimeMcpAgentToolGrantList>;
    listMcpAgentHostTools(agentId: string): Promise<AgentRuntimeHostToolList>;
    listMcpConnections(): Promise<AgentRuntimeMcpConnectionList>;
    listMcpConnectionTools(connectionId: string): Promise<AgentRuntimeMcpToolList>;
    listRuntimeJobs(): Promise<AgentRuntimeJobList>;
    listSessionMessages(
        sessionKey: string,
        options?: AgentRuntimeListSessionMessagesOptions
    ): Promise<AgentRuntimeSessionMessageList>;
    listSessionPreviews(
        input: AgentRuntimeListSessionPreviewsInput
    ): Promise<AgentRuntimeSessionPreviewList>;
    listSessions(): Promise<AgentRuntimeSessionList>;
    listSkillHubTaps(): Promise<AgentRuntimeSkillHubTapList>;
    listSkills(
        options?: AgentRuntimeListSkillsOptions
    ): Promise<{ skills: AgentRuntimeSkillSummary[] }>;
    listTools(): Promise<AgentRuntimeToolList>;
    listWorkspaceFiles(
        agentId: string,
        input?: AgentRuntimeWorkspaceFileListInput
    ): Promise<AgentRuntimeWorkspaceFileList>;
    openBrowser(): Promise<AgentRuntimeBrowserActionResult>;
    pollModelProviderOAuth(input: AgentRuntimePollModelProviderOAuth): Promise<unknown>;
    postMessage(
        chatId: string,
        input: AgentRuntimeCreateMessage
    ): Promise<AgentRuntimeMessageAccepted>;
    previewSkillHubSkill(identifier: string): Promise<AgentRuntimeSkillHubPreview>;
    redeemIdentityInvite(userSessionToken: string, code: string): Promise<void>;
    refreshCapability(id: AgentRuntimeCapabilityHealthId): Promise<AgentRuntimeCapabilityHealth>;
    refreshMcpConnection(connectionId: string): Promise<AgentRuntimeMcpToolList>;
    removeIdentityMember(userId: string): Promise<RuntimeIdentityMutationResult>;
    removeSkillHubTap(repo: string): Promise<AgentRuntimeSkillHubTapList>;
    resetAgentSession(
        agentId: string,
        input: AgentRuntimeResetAgentSession
    ): Promise<AgentRuntimeResetAgentSessionResult>;
    resetSkill(skillId: string): Promise<AgentRuntimeSkillResetResult>;
    restartAgent(agentId: string): Promise<AgentRuntimeRestartAgentResult>;
    restartBrowser(): Promise<AgentRuntimeBrowserActionResult>;
    restartForUpdate(): Promise<AgentRuntimeUpdate>;
    resyncSession(sessionKey: string): Promise<AgentRuntimeSessionResync>;
    runRuntimeJob(
        slug: AgentRuntimeJobSlug,
        input?: AgentRuntimeRunJobInput
    ): Promise<AgentRuntimeRunJob>;
    runToolPostSetup(
        toolId: string,
        input: AgentRuntimeToolPostSetup
    ): Promise<AgentRuntimeSkillHubActionResult>;
    saveAgentEnv(input: AgentRuntimeSaveAgentEnv): Promise<AgentRuntimeSaveAgentEnvResult>;
    saveAgentFile(
        agentId: string,
        path: string,
        input: AgentRuntimeSaveAgentFile
    ): Promise<AgentRuntimeAgentFileContent>;
    saveBrowserSettings(
        input: AgentRuntimeSaveBrowserSettings
    ): Promise<AgentRuntimeBrowserSettings>;
    saveDiscordBinding(
        input: AgentRuntimeSaveDiscordBinding
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    saveModelCapabilitySelections(
        input: AgentRuntimeSaveModelCapabilitySelections
    ): Promise<AgentRuntimeModelCapabilitySelectionSettings>;
    saveModelCategorySettings(
        input: AgentRuntimeSaveModelCategorySettings
    ): Promise<AgentRuntimeSaveModelCategorySettingsResult>;
    saveModelProviderApiKey(input: AgentRuntimeSaveModelProviderApiKey): Promise<{ ok: boolean }>;
    saveOpenAiSettings(input: AgentRuntimeSaveOpenAiSettings): Promise<AgentRuntimeOpenAiSettings>;
    saveOpenRouterSettings(
        input: AgentRuntimeSaveOpenRouterSettings
    ): Promise<AgentRuntimeOpenRouterSettings>;
    saveTimezoneSettings(
        input: AgentRuntimeSaveTimezoneSettings
    ): Promise<AgentRuntimeSaveTimezoneSettingsResult>;
    saveToolEnv(
        toolId: string,
        input: AgentRuntimeToolEnvUpdate
    ): Promise<AgentRuntimeToolEnvUpdateResult>;
    saveWorkspaceInstructions(
        agentId: string,
        input: AgentRuntimeSaveWorkspaceInstructions
    ): Promise<AgentRuntimeWorkspaceInstructions>;
    scanSkillHubSkill(identifier: string): Promise<AgentRuntimeSkillHubScan>;
    selectToolProvider(
        toolId: string,
        input: AgentRuntimeToolProviderSelect
    ): Promise<AgentRuntimeToolProviderSelectResult>;
    setChatPaneState(
        chatId: string,
        input: AgentRuntimeSetChatPaneStateRequest
    ): Promise<AgentRuntimeSetChatPaneStateResult>;
    setMcpAgentHostToolGrant(
        agentId: string,
        toolId: 'browser' | 'web_fetch',
        enabled: boolean
    ): Promise<{ enabled: boolean }>;
    setMcpAgentToolGrant(
        agentId: string,
        connectionId: string,
        toolName: string,
        enabled: boolean
    ): Promise<{ enabled: boolean }>;
    setModelProviderEnabled(
        providerId: string,
        input: AgentRuntimeUpdateModelProvider
    ): Promise<AgentRuntimeModelProviderCatalogEntry>;
    startMcpConnectionOAuth(
        connectionId: string,
        input: AgentRuntimeMcpOAuthStart
    ): Promise<AgentRuntimeMcpOAuthStartResult>;
    startModelProviderOAuth(input: AgentRuntimeStartModelProviderOAuth): Promise<unknown>;
    startUpdate(input?: { targetVersion?: null | string }): Promise<AgentRuntimeUpdate>;
    stopAgent(agentId: string): Promise<AgentRuntimeAgentStopResult>;
    stopChatTurn(chatId: string, input: AgentRuntimeStopTurn): Promise<AgentRuntimeStopTurnResult>;
    submitModelProviderOAuth(input: AgentRuntimeSubmitModelProviderOAuth): Promise<unknown>;
    testMcpConnection(connectionId: string): Promise<AgentRuntimeMcpConnectionTestResult>;
    uninstallSkillHubSkill(
        input: AgentRuntimeSkillHubUninstallInput
    ): Promise<AgentRuntimeSkillHubActionResult>;
    updateAgentBio(
        agentId: string,
        input: AgentRuntimeUpdateAgentBio
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateAgentModel(
        agentId: string,
        input: AgentRuntimeUpdateAgentModel
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateAgentName(
        agentId: string,
        input: AgentRuntimeUpdateAgentName
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateAgentThinkingDefault(
        agentId: string,
        input: AgentRuntimeUpdateAgentThinkingDefault
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateAgentWebSettings(
        agentId: string,
        input: AgentRuntimeUpdateAgentWebSettings
    ): Promise<AgentRuntimeAgent>;
    updateMcpConnection(
        connectionId: string,
        input: AgentRuntimeMcpConnectionUpdate
    ): Promise<AgentRuntimeMcpConnection>;
    updateSkillEnabled(
        skillId: string,
        input: AgentRuntimeUpdateSkillEnabled
    ): Promise<AgentRuntimeSkill>;
    updateToolEnabled(
        toolId: string,
        input: AgentRuntimeUpdateToolEnabled
    ): Promise<AgentRuntimeTool>;
    upsertAgent(input: AgentRuntimeCreateAgent): Promise<AgentRuntimeAgent>;
    upsertBinding(input: AgentRuntimeUpsertBinding): Promise<AgentRuntimeBinding>;
}

export interface AgentRuntimeListSessionMessagesOptions {
    limit?: number;
}

export interface AgentRuntimeListEventsInput {
    afterCursor?: string;
    limit?: number;
}

export interface AgentRuntimeListSessionPreviewsInput {
    keys: string[];
    limit?: number;
    maxChars?: number;
}

export interface AgentRuntimeListSkillsOptions {
    agentId?: string;
}

interface AgentRuntimeClientOptions {
    baseUrl: string;
    token?: string;
}

function trimTrailingSlash(value: string) {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function readErrorResponse(response: Response) {
    const payload = await response.json().catch(() => null);
    const parsed = agentRuntimeErrorSchema.safeParse(payload);

    if (parsed.success) {
        throw new AgentRuntimeRequestError({
            code: parsed.data.code,
            message: parsed.data.message,
            retryable: parsed.data.retryable,
            status: response.status,
        });
    }

    throw new AgentRuntimeRequestError({
        code: 'control_plane_request_failed',
        message: `Runtime request failed with status ${response.status}.`,
        retryable: response.status >= 500,
        status: response.status,
    });
}

class HttpTavernAgentRuntimeClient implements TavernAgentRuntimeClient {
    readonly #baseUrl: string;
    readonly #authHeaders: Record<string, string>;

    constructor(options: AgentRuntimeClientOptions) {
        const parsed = agentRuntimeClientOptionsSchema.parse(options);
        this.#baseUrl = trimTrailingSlash(parsed.baseUrl);
        this.#authHeaders = parsed.token ? { authorization: `Bearer ${parsed.token}` } : {};
    }

    close() {}

    async upsertAgent(input: AgentRuntimeCreateAgent) {
        const payload = agentRuntimeCreateAgentSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agents}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentSchema.parse(await response.json());
    }

    async listAgentActivity(agentId: string, limit?: number) {
        const query = limit ? `?limit=${limit}` : '';
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentActivity(agentId)}${query}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentActivityListSchema.parse(await response.json());
    }

    async listAgentPresence() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentPresence}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentPresenceListSchema.parse(await response.json());
    }

    async getAgentInbox(agentId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentInbox(agentId)}`, {
            headers: this.#authHeaders,
        });
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return agentRuntimeAgentInboxSchema.parse(await response.json());
    }

    async stopAgent(agentId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentStop(agentId)}`, {
            headers: {
                ...this.#authHeaders,
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return agentRuntimeAgentStopResultSchema.parse(await response.json());
    }

    async restartAgent(agentId: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentRestart(agentId)}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return agentRuntimeRestartAgentResultSchema.parse(await response.json());
    }

    async getAgentConfig(agentId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentConfig(agentId)}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentSchema.parse(await response.json());
    }

    async listAgentFiles(agentId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentFiles(agentId)}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentFileListSchema.parse(await response.json());
    }

    async getAgentFile(agentId: string, path: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentFile(agentId, path)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentFileContentSchema.parse(await response.json());
    }

    async listWorkspaceFiles(
        agentId: string,
        input: AgentRuntimeWorkspaceFileListInput = { path: '' }
    ) {
        const payload = agentRuntimeWorkspaceFileListInputSchema.parse(input);
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.workspaceAgentFiles(agentId)}`);
        if (payload.path) {
            url.searchParams.set('path', payload.path);
        }

        const response = await fetch(url, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeWorkspaceFileListSchema.parse(await response.json());
    }

    async getWorkspaceFile(agentId: string, path: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.workspaceAgentFile(agentId, path)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeWorkspaceFileContentSchema.parse(await response.json());
    }

    async saveAgentFile(agentId: string, path: string, input: AgentRuntimeSaveAgentFile) {
        const payload = agentRuntimeSaveAgentFileSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentFile(agentId, path)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentFileContentSchema.parse(await response.json());
    }

    async saveWorkspaceInstructions(agentId: string, input: AgentRuntimeSaveWorkspaceInstructions) {
        const payload = agentRuntimeSaveWorkspaceInstructionsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.workspaceAgentInstructions(agentId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeWorkspaceInstructionsSchema.parse(await response.json());
    }

    async getWorkspaceInstructions(agentId: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.workspaceAgentInstructions(agentId)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeRenderedWorkspaceInstructionsSchema.parse(await response.json());
    }

    async listAgents() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agents}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentListSchema.parse(await response.json());
    }

    async listEvents(input: AgentRuntimeListEventsInput = {}) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.events}`);
        if (input.afterCursor) {
            url.searchParams.set('after_cursor', input.afterCursor);
        }
        if (input.limit !== undefined) {
            url.searchParams.set('limit', String(input.limit));
        }
        const response = await fetch(url, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return runtimeEventListSchema.parse(await response.json());
    }

    async deleteAgent(agentId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agent(agentId)}`, {
            headers: {
                ...this.#authHeaders,
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'DELETE',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeArchiveAgentSchema.parse(await response.json());
    }

    async listRuntimeJobs() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.jobs}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeJobListSchema.parse(await response.json());
    }

    async listCapabilities() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.capabilities}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return parseAgentRuntimeCapabilityHealthList(await response.json());
    }

    async resetAgentSession(agentId: string, input: AgentRuntimeResetAgentSession) {
        const payload = agentRuntimeResetAgentSessionSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentSessionReset(agentId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeResetAgentSessionResultSchema.parse(await response.json());
    }

    async getCapability(id: AgentRuntimeCapabilityHealthId) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.capability(
                agentRuntimeCapabilityHealthIdSchema.parse(id)
            )}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCapabilityHealthSchema.parse(await response.json());
    }

    async refreshCapability(id: AgentRuntimeCapabilityHealthId) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.capabilityRefresh(
                agentRuntimeCapabilityHealthIdSchema.parse(id)
            )}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCapabilityHealthSchema.parse(await response.json());
    }

    async getUpdateStatus(): Promise<AgentRuntimeUpdate> {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.updateStatus}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeUpdateSchema.parse(await response.json());
    }

    async restartForUpdate(): Promise<AgentRuntimeUpdate> {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.updateRestart}`, {
            headers: {
                ...this.#authHeaders,
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeUpdateSchema.parse(await response.json());
    }

    async startUpdate(input?: { targetVersion?: null | string }): Promise<AgentRuntimeUpdate> {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.update}`, {
            body: JSON.stringify(input ?? {}),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeUpdateSchema.parse(await response.json());
    }

    async getRuntimeJob(slug: AgentRuntimeJobSlug) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.job(agentRuntimeJobSlugSchema.parse(slug))}`,
            { headers: this.#authHeaders }
        );

        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeJobDetailSchema.parse(await response.json());
    }

    async runRuntimeJob(slug: AgentRuntimeJobSlug, input?: AgentRuntimeRunJobInput) {
        const body = input ? agentRuntimeRunJobInputSchema.parse(input) : null;
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.jobRun(agentRuntimeJobSlugSchema.parse(slug))}`,
            {
                body: body ? JSON.stringify(body) : undefined,
                headers: {
                    ...this.#authHeaders,
                    ...(body ? { 'content-type': 'application/json' } : {}),
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeRunJobSchema.parse(await response.json());
    }

    async getModels() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.models}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelsSchema.parse(await response.json());
    }

    async getAgentEngineConfig() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentEngineConfig}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async applyAgentEngineConfig(input: AgentRuntimeApplyAgentEngineConfig) {
        const payload = agentRuntimeApplyAgentEngineConfigSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentEngineConfig}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async updateAgentBio(agentId: string, input: AgentRuntimeUpdateAgentBio) {
        const payload = agentRuntimeUpdateAgentBioSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentBio(agentId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PATCH',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async updateAgentName(agentId: string, input: AgentRuntimeUpdateAgentName) {
        const payload = agentRuntimeUpdateAgentNameSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentName(agentId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PATCH',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async updateAgentModel(agentId: string, input: AgentRuntimeUpdateAgentModel) {
        const payload = agentRuntimeUpdateAgentModelSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentModel(agentId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PATCH',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async updateAgentThinkingDefault(
        agentId: string,
        input: AgentRuntimeUpdateAgentThinkingDefault
    ) {
        const payload = agentRuntimeUpdateAgentThinkingDefaultSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentThinkingDefault(agentId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PATCH',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async updateAgentWebSettings(agentId: string, input: AgentRuntimeUpdateAgentWebSettings) {
        const payload = agentRuntimeUpdateAgentWebSettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentWebSettings(agentId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PATCH',
            }
        );
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return agentRuntimeAgentSchema.parse(await response.json());
    }

    async getModelAccess() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.modelAccess}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelAccessSchema.parse(await response.json());
    }

    async getModelProviderCatalog() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelProvidersCatalog}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderCatalogSchema.parse(await response.json());
    }

    async getModelProvidersEnabled() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelProvidersEnabled}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderEnabledSchema.parse(await response.json());
    }

    async setModelProviderEnabled(providerId: string, input: AgentRuntimeUpdateModelProvider) {
        const payload = agentRuntimeUpdateModelProviderSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelProvider(providerId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: payload.enabled ? 'PUT' : 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderCatalogEntrySchema.parse(await response.json());
    }

    async saveModelProviderApiKey(input: AgentRuntimeSaveModelProviderApiKey) {
        const payload = agentRuntimeSaveModelProviderApiKeySchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.modelAccessApiKey}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return { ok: true };
    }

    async startModelProviderOAuth(input: AgentRuntimeStartModelProviderOAuth) {
        const payload = agentRuntimeStartModelProviderOAuthSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOAuthStart(payload.providerId)}`,
            {
                body: JSON.stringify({}),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderOAuthStartSchema.parse(await response.json());
    }

    async pollModelProviderOAuth(input: AgentRuntimePollModelProviderOAuth) {
        const payload = agentRuntimePollModelProviderOAuthSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOAuthPoll(payload.providerId, payload.sessionId)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderOAuthPollSchema.parse(await response.json());
    }

    async submitModelProviderOAuth(input: AgentRuntimeSubmitModelProviderOAuth) {
        const payload = agentRuntimeSubmitModelProviderOAuthSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOAuthSubmit(payload.providerId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderOAuthSubmitSchema.parse(await response.json());
    }

    async cancelModelProviderOAuth(input: AgentRuntimeCancelModelProviderOAuth) {
        const payload = agentRuntimeCancelModelProviderOAuthSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOAuthCancel(payload.sessionId)}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderOAuthCancelSchema.parse(await response.json());
    }

    async getOpenRouterSettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenRouterSettings}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenRouterSettingsSchema.parse(await response.json());
    }

    async getOpenAiSettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenAiSettings}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenAiSettingsSchema.parse(await response.json());
    }

    async saveOpenAiSettings(input: AgentRuntimeSaveOpenAiSettings) {
        const payload = agentRuntimeSaveOpenAiSettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenAiSettings}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenAiSettingsSchema.parse(await response.json());
    }

    async deleteOpenAiSettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenAiSettings}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenAiSettingsSchema.parse(await response.json());
    }

    async saveOpenRouterSettings(input: AgentRuntimeSaveOpenRouterSettings) {
        const payload = agentRuntimeSaveOpenRouterSettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenRouterSettings}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenRouterSettingsSchema.parse(await response.json());
    }

    async deleteOpenRouterSettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenRouterSettings}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenRouterSettingsSchema.parse(await response.json());
    }

    // Identity requests act as the signed-in user, not the runtime token: the
    // runtime resolves membership (and first-connect ownership claim) from the
    // forwarded Clerk session token.
    async getIdentityMe(userSessionToken: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.identityMe}`, {
            headers: { authorization: `Bearer ${userSessionToken}` },
        });
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return runtimeIdentityMeSchema.parse(await response.json());
    }

    async redeemIdentityInvite(userSessionToken: string, code: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.identityInviteRedeem}`, {
            body: JSON.stringify({ code }),
            headers: {
                authorization: `Bearer ${userSessionToken}`,
                'content-type': 'application/json',
            },
            method: 'POST',
        });
        if (!response.ok) {
            await readErrorResponse(response);
        }
    }

    async listIdentityMembers() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.identityMembers}`, {
            headers: this.#authHeaders,
        });
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return runtimeMemberListSchema.parse(await response.json());
    }

    async listIdentityInvites() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.identityInvites}`, {
            headers: this.#authHeaders,
        });
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return runtimeInviteListSchema.parse(await response.json());
    }

    async createIdentityInvite() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.identityInvites}`, {
            headers: this.#authHeaders,
            method: 'POST',
        });
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return runtimeInviteCreateResultSchema.parse(await response.json());
    }

    async deleteIdentityInvite(inviteId: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.identityInvite(inviteId)}`,
            { headers: this.#authHeaders, method: 'DELETE' }
        );
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return runtimeIdentityMutationResultSchema.parse(await response.json());
    }

    async removeIdentityMember(userId: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.identityMember(userId)}`,
            { headers: this.#authHeaders, method: 'DELETE' }
        );
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return runtimeIdentityMutationResultSchema.parse(await response.json());
    }

    async getTimezoneSettings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.timezoneSettings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeTimezoneSettingsSchema.parse(await response.json());
    }

    async saveTimezoneSettings(input: AgentRuntimeSaveTimezoneSettings) {
        const payload = agentRuntimeSaveTimezoneSettingsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.timezoneSettings}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSaveTimezoneSettingsResultSchema.parse(await response.json());
    }

    async getModelCategorySettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelCategorySettings}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelCategorySettingsSchema.parse(await response.json());
    }

    async getModelCapabilitySelections() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelCapabilitySelections}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelCapabilitySelectionSettingsSchema.parse(await response.json());
    }

    async saveModelCategorySettings(input: AgentRuntimeSaveModelCategorySettings) {
        const payload = agentRuntimeSaveModelCategorySettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelCategorySettings}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSaveModelCategorySettingsResultSchema.parse(await response.json());
    }

    async saveModelCapabilitySelections(input: AgentRuntimeSaveModelCapabilitySelections) {
        const payload = agentRuntimeSaveModelCapabilitySelectionsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelCapabilitySelections}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelCapabilitySelectionSettingsSchema.parse(await response.json());
    }

    async getAgentEnv(): Promise<AgentRuntimeAgentEnv> {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentEnv}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEnvSchema.parse(await response.json());
    }

    async saveAgentEnv(input: AgentRuntimeSaveAgentEnv): Promise<AgentRuntimeSaveAgentEnvResult> {
        const payload = agentRuntimeSaveAgentEnvSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentEnv}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSaveAgentEnvResultSchema.parse(await response.json());
    }

    async getBrowserSettings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.browserSettings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeBrowserSettingsSchema.parse(await response.json());
    }

    async saveBrowserSettings(input: AgentRuntimeSaveBrowserSettings) {
        const payload = agentRuntimeSaveBrowserSettingsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.browserSettings}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeBrowserSettingsSchema.parse(await response.json());
    }

    async openBrowser() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.browserOpen}`, {
            body: JSON.stringify({}),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeBrowserActionResultSchema.parse(await response.json());
    }

    async restartBrowser() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.browserRestart}`, {
            body: JSON.stringify({}),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeBrowserActionResultSchema.parse(await response.json());
    }

    async listSkills(options?: AgentRuntimeListSkillsOptions) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.skills}`);
        if (options?.agentId) {
            url.searchParams.set('agentId', options.agentId);
        }
        const response = await fetch(url, { headers: this.#authHeaders });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSkillListSchema.parse(await response.json());
    }

    async getSkill(skillId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.skill(skillId)}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSkillSchema.parse(await response.json());
    }

    async listTools() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.tools}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeToolListSchema.parse(await response.json());
    }

    async updateSkillEnabled(skillId: string, input: AgentRuntimeUpdateSkillEnabled) {
        const payload = agentRuntimeUpdateSkillEnabledSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.skillEnabled(skillId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSkillSchema.parse(await response.json());
    }

    async updateToolEnabled(toolId: string, input: AgentRuntimeUpdateToolEnabled) {
        const payload = agentRuntimeUpdateToolEnabledSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.toolEnabled(toolId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeToolSchema.parse(await response.json());
    }

    async getSkillHubAvailable() {
        return agentRuntimeSkillHubAvailableSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.skillHubAvailable)
        );
    }

    async previewSkillHubSkill(identifier: string) {
        const params = new URLSearchParams({ identifier });
        return agentRuntimeSkillHubPreviewSchema.parse(
            await this.#getSkillHubJson(
                `${agentRuntimeRoutes.skillHubPreview}?${params.toString()}`
            )
        );
    }

    async scanSkillHubSkill(identifier: string) {
        const params = new URLSearchParams({ identifier });
        return agentRuntimeSkillHubScanSchema.parse(
            await this.#getSkillHubJson(`${agentRuntimeRoutes.skillHubScan}?${params.toString()}`)
        );
    }

    async installSkillHubSkill(input: AgentRuntimeSkillHubInstallInput) {
        const payload = agentRuntimeSkillHubInstallInputSchema.parse(input);
        return agentRuntimeSkillHubActionResultSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.skillHubInstall, payload)
        );
    }

    async uninstallSkillHubSkill(input: AgentRuntimeSkillHubUninstallInput) {
        const payload = agentRuntimeSkillHubUninstallInputSchema.parse(input);
        return agentRuntimeSkillHubActionResultSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.skillHubUninstall, payload)
        );
    }

    async resetSkill(skillId: string) {
        return agentRuntimeSkillResetResultSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.skillReset(skillId), undefined)
        );
    }

    async listSkillHubTaps() {
        return agentRuntimeSkillHubTapListSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.skillHubTaps)
        );
    }

    async addSkillHubTap(input: AgentRuntimeSkillHubTap) {
        const payload = agentRuntimeSkillHubTapSchema.parse(input);
        return agentRuntimeSkillHubTapListSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.skillHubTaps, payload)
        );
    }

    async removeSkillHubTap(repo: string) {
        return agentRuntimeSkillHubTapListSchema.parse(
            await this.#sendSkillHubJson('DELETE', agentRuntimeRoutes.skillHubTap(repo), undefined)
        );
    }

    async getToolConfig(toolId: string) {
        return agentRuntimeToolConfigSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.toolConfig(toolId))
        );
    }

    async listMcpConnections() {
        return agentRuntimeMcpConnectionListSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.mcpConnections)
        );
    }

    async addMcpConnection(input: AgentRuntimeMcpConnectionCreate) {
        return agentRuntimeMcpConnectionSchema.parse(
            await this.#sendSkillHubJson(
                'POST',
                agentRuntimeRoutes.mcpConnections,
                agentRuntimeMcpConnectionCreateSchema.parse(input)
            )
        );
    }

    async addMcpPresetAccount(input: AgentRuntimeMcpPresetAccountCreate) {
        return agentRuntimeMcpConnectionSchema.parse(
            await this.#sendSkillHubJson(
                'POST',
                agentRuntimeRoutes.mcpPresetAccounts,
                agentRuntimeMcpPresetAccountCreateSchema.parse(input)
            )
        );
    }

    async updateMcpConnection(connectionId: string, input: AgentRuntimeMcpConnectionUpdate) {
        return agentRuntimeMcpConnectionSchema.parse(
            await this.#sendSkillHubJson(
                'PATCH',
                agentRuntimeRoutes.mcpConnection(connectionId),
                agentRuntimeMcpConnectionUpdateSchema.parse(input)
            )
        );
    }

    async deleteMcpConnection(connectionId: string) {
        return agentRuntimeMcpDisconnectResultSchema.parse(
            await this.#sendSkillHubJson(
                'DELETE',
                agentRuntimeRoutes.mcpConnection(connectionId),
                undefined
            )
        );
    }

    async disconnectMcpConnection(connectionId: string) {
        return agentRuntimeMcpDisconnectResultSchema.parse(
            await this.#sendSkillHubJson(
                'POST',
                agentRuntimeRoutes.mcpConnectionDisconnect(connectionId),
                {}
            )
        );
    }

    async testMcpConnection(connectionId: string) {
        return agentRuntimeMcpConnectionTestResultSchema.parse(
            await this.#sendSkillHubJson(
                'POST',
                agentRuntimeRoutes.mcpConnectionTest(connectionId),
                {}
            )
        );
    }

    async listMcpConnectionTools(connectionId: string) {
        return agentRuntimeMcpToolListSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.mcpConnectionTools(connectionId))
        );
    }

    async refreshMcpConnection(connectionId: string) {
        return agentRuntimeMcpToolListSchema.parse(
            await this.#sendSkillHubJson(
                'POST',
                agentRuntimeRoutes.mcpConnectionRefresh(connectionId),
                {}
            )
        );
    }

    async listMcpAgentGrants(agentId: string) {
        return agentRuntimeMcpAgentToolGrantListSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.mcpAgentGrants(agentId))
        );
    }

    async listMcpAgentHostTools(agentId: string) {
        return agentRuntimeHostToolListSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.mcpAgentHostTools(agentId))
        );
    }

    async setMcpAgentToolGrant(
        agentId: string,
        connectionId: string,
        toolName: string,
        enabled: boolean
    ) {
        return (await this.#sendSkillHubJson(
            'PUT',
            agentRuntimeRoutes.mcpAgentToolGrant(agentId, connectionId, toolName),
            { enabled }
        )) as { enabled: boolean };
    }

    async setMcpAgentHostToolGrant(
        agentId: string,
        toolId: 'browser' | 'web_fetch',
        enabled: boolean
    ) {
        return (await this.#sendSkillHubJson(
            'PUT',
            agentRuntimeRoutes.mcpAgentHostToolGrant(agentId, toolId),
            { enabled }
        )) as { enabled: boolean };
    }

    async startMcpConnectionOAuth(connectionId: string, input: AgentRuntimeMcpOAuthStart) {
        return agentRuntimeMcpOAuthStartResultSchema.parse(
            await this.#sendSkillHubJson(
                'POST',
                agentRuntimeRoutes.mcpConnectionOAuthStart(connectionId),
                agentRuntimeMcpOAuthStartSchema.parse(input)
            )
        );
    }

    async completeMcpConnectionOAuth(connectionId: string, input: AgentRuntimeMcpOAuthComplete) {
        return agentRuntimeMcpConnectionSchema.parse(
            await this.#sendSkillHubJson(
                'POST',
                agentRuntimeRoutes.mcpConnectionOAuthComplete(connectionId),
                agentRuntimeMcpOAuthCompleteSchema.parse(input)
            )
        );
    }

    async selectToolProvider(toolId: string, input: AgentRuntimeToolProviderSelect) {
        const payload = agentRuntimeToolProviderSelectSchema.parse(input);
        return agentRuntimeToolProviderSelectResultSchema.parse(
            await this.#sendSkillHubJson('PUT', agentRuntimeRoutes.toolProvider(toolId), payload)
        );
    }

    async saveToolEnv(toolId: string, input: AgentRuntimeToolEnvUpdate) {
        const payload = agentRuntimeToolEnvUpdateSchema.parse(input);
        return agentRuntimeToolEnvUpdateResultSchema.parse(
            await this.#sendSkillHubJson('PUT', agentRuntimeRoutes.toolEnv(toolId), payload)
        );
    }

    async runToolPostSetup(toolId: string, input: AgentRuntimeToolPostSetup) {
        const payload = agentRuntimeToolPostSetupSchema.parse(input);
        return agentRuntimeSkillHubActionResultSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.toolPostSetup(toolId), payload)
        );
    }

    async #getSkillHubJson(pathname: string) {
        const response = await fetch(`${this.#baseUrl}${pathname}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return await response.json();
    }

    async #sendSkillHubJson(
        method: 'DELETE' | 'PATCH' | 'POST' | 'PUT',
        pathname: string,
        payload: unknown
    ) {
        const response = await fetch(`${this.#baseUrl}${pathname}`, {
            ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return await response.json();
    }

    async listMacApps(options?: { limit?: number; query?: string }) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.macApps}`);

        if (options?.query) {
            url.searchParams.set('query', options.query);
        }

        if (options?.limit !== undefined) {
            url.searchParams.set('limit', String(options.limit));
        }

        const response = await fetch(url, { headers: this.#authHeaders });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMacAppListSchema.parse(await response.json());
    }

    async postMessage(chatId: string, input: AgentRuntimeCreateMessage) {
        const payload = agentRuntimeCreateMessageSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.chatMessages(chatId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMessageAcceptedSchema.parse(await response.json());
    }

    async getCurrentAgentSession(input: { agentId?: string; chatId: string }) {
        const url = new URL(
            `${this.#baseUrl}${agentRuntimeRoutes.chatAgentSessionCurrent(input.chatId)}`
        );

        if (input.agentId) {
            url.searchParams.set('agentId', input.agentId);
        }

        const response = await fetch(url, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCurrentAgentSessionResultSchema.parse(await response.json());
    }

    async stopChatTurn(
        chatId: string,
        input: AgentRuntimeStopTurn
    ): Promise<AgentRuntimeStopTurnResult> {
        const payload = agentRuntimeStopTurnSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.chatTurnStop(chatId, payload.runId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeStopTurnResultSchema.parse(await response.json());
    }

    async listChats() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.chats}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeChatListSchema.parse(await response.json());
    }

    async getChatPaneState(chatId: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.chatPaneState(chatId)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeChatPaneStateSchema.parse(await response.json());
    }

    async setChatPaneState(chatId: string, input: AgentRuntimeSetChatPaneStateRequest) {
        const payload = agentRuntimeSetChatPaneStateRequestSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.chatPaneState(chatId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        // 409 carries the current state so callers can rebase without refetching.
        if (!(response.ok || response.status === 409)) {
            await readErrorResponse(response);
        }

        return agentRuntimeSetChatPaneStateResultSchema.parse(await response.json());
    }

    async upsertBinding(input: AgentRuntimeUpsertBinding) {
        const payload = agentRuntimeUpsertBindingSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.bindings}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeBindingSchema.parse(await response.json());
    }

    async saveDiscordBinding(input: AgentRuntimeSaveDiscordBinding) {
        const payload = agentRuntimeSaveDiscordBindingSchema.parse(input);
        const url = payload.bindingId
            ? agentRuntimeRoutes.discordBinding(payload.bindingId)
            : agentRuntimeRoutes.discordBindings;
        const response = await fetch(`${this.#baseUrl}${url}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: payload.bindingId ? 'PUT' : 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async listBindings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.bindings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeBindingListSchema.parse(await response.json());
    }

    async listDiscordBindings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.discordBindings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeDiscordBindingListSchema.parse(await response.json());
    }

    async deleteBinding(bindingId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.binding(bindingId)}`, {
            headers: this.#authHeaders,
            method: 'DELETE',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeArchiveBindingSchema.parse(await response.json());
    }

    async deleteDiscordBinding(bindingId: string, input: AgentRuntimeDeleteDiscordBinding) {
        const payload = agentRuntimeDeleteDiscordBindingSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.discordBinding(bindingId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async listSessions() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.sessions}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionListSchema.parse(await response.json());
    }

    async listSessionMessages(
        sessionKey: string,
        options?: AgentRuntimeListSessionMessagesOptions
    ) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.sessionMessages(sessionKey)}`);

        if (options?.limit !== undefined) {
            url.searchParams.set('limit', String(options.limit));
        }

        const response = await fetch(url, { headers: this.#authHeaders });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionMessageListSchema.parse(await response.json());
    }

    async listSessionPreviews(input: AgentRuntimeListSessionPreviewsInput) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.sessionPreviews}`);

        for (const key of input.keys) {
            url.searchParams.append('key', key);
        }
        if (input.limit !== undefined) {
            url.searchParams.set('limit', String(input.limit));
        }
        if (input.maxChars !== undefined) {
            url.searchParams.set('maxChars', String(input.maxChars));
        }

        const response = await fetch(url, { headers: this.#authHeaders });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionPreviewListSchema.parse(await response.json());
    }

    async getSessionGraph(sessionKey: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.sessionGraph(sessionKey)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionGraphSchema.parse(await response.json());
    }

    async getSessionPrompt(sessionKey: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.sessionPrompt(sessionKey)}`,
            { headers: this.#authHeaders }
        );

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionPromptSchema.parse(await response.json());
    }

    async resyncSession(sessionKey: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.sessionResync(sessionKey)}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionResyncSchema.parse(await response.json());
    }
}

export function createAgentRuntimeClient(
    baseUrl: string,
    options?: { token?: string }
): TavernAgentRuntimeClient {
    return new HttpTavernAgentRuntimeClient({
        baseUrl,
        token: options?.token,
    });
}

function parseAgentRuntimeCapabilityHealthList(input: unknown): AgentRuntimeCapabilityHealthList {
    return agentRuntimeCapabilityHealthListSchema.parse(input);
}
