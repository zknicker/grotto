import ClerkKit
import Foundation
import GrottoModels
import GrottoTransport
import GrottoUI
import Observation
import OSLog

@MainActor
@Observable
final class GrottoStore {
    static let logger = Logger(subsystem: "build.grotto.ios", category: "server")
    enum State {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    private(set) var state: State = .idle
    private(set) var isConnected = false
    private(set) var servers: [ServerSummary] = []
    var agents: [AgentSummary] = []
    var members: MemberList?
    // Internal so the app-only computer loader can live in its own file.
    var computers: [ComputerSummary]?
    var chats: [ChatSummary] = []
    var receiptBackedAgentDMsByChatID: [String: String] = [:]
    var messagesByChatID: [String: ChatMessagePage] = [:]
    var pendingMessagesByChatID: [String: [PendingChatMessage]] = [:]
    var mentionOptionsByDestinationID: [ChatDestination.ID: [MentionOptionPresentation]] = [:]
    private(set) var lifecycleAvailability: [String: AgentAvailability] = [:]
    var currentActivityByAgentID: [String: AgentActivityEvent] = [:]
    var currentActivityPositionByRunID: [String: Int] = [:]
    private var lifecycleRevision = 0
    var sendError: String?
    var chatEventServerID: String?
    var chatEventReplay = ChatEventReplayState()
    var chatEventCatchUpInFlight = false
    var chatEventCatchUpPending = false
    var openChatID: String?
    var acknowledgedReadSequences: [ChatReadScope: Int] = [:]
    var readAcknowledgementsInFlight: Set<ChatReadAcknowledgement> = []
    var olderMessageLoadsInFlight: Set<String> = []
    private var foregroundRefreshInFlight = false
    let clerk: Clerk
    let client: TRPCClient
    private nonisolated let eventTasks = EventTaskBag()

    init(clerk: Clerk) {
        self.clerk = clerk
        let config = AppConfig(
            serverOrigin: GrottoRuntimeConfiguration.serverOrigin,
            productVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.1.0"
        )
        client = TRPCClient(
            config: config,
            sessionTokenProvider: ClerkSessionTokenProvider(clerk: clerk),
            decoder: GrottoJSON.decoder()
        )
    }

    deinit {
        eventTasks.cancelAll()
    }

    var activeServer: ServerSummary? { servers.first }

    func start() async {
        guard case .idle = state else { return }
        state = .loading
        do {
            if GrottoRuntimeConfiguration.development != nil {
                let _: ServerSummary = try await client.mutation("server.developmentBootstrap")
            }
            let loadedServers: [ServerSummary] = try await client.query("server.list")
            servers = loadedServers
            guard let server = loadedServers.first else {
                state = .failed("You do not have a Grotto Server yet.")
                return
            }
            try await syncHumanIdentity(serverID: server.id)
            try await reloadServer(server.id)
            startEventStreams(serverID: server.id)
            isConnected = true
            state = .loaded
        } catch {
            state = .failed(error.localizedDescription)
            isConnected = false
        }
    }

    func retry() async {
        stopEventStreams()
        state = .idle
        await start()
    }

    /// Rehydrates durable Server state after iOS suspends the app.
    ///
    /// Subscriptions are notification streams, not a durable history. Refetching the
    /// canonical lists and every message page already held in memory prevents a
    /// foregrounded app from presenting a stale cache while the streams reconnect.
    func resumeAfterForeground() async {
        guard case .loaded = state,
              !foregroundRefreshInFlight,
              let serverID = activeServer?.id
        else { return }

        foregroundRefreshInFlight = true
        defer { foregroundRefreshInFlight = false }
        isConnected = false
        stopEventStreams()

        do {
            try await refreshServerSnapshot(serverID: serverID)
            startEventStreams(serverID: serverID)
            isConnected = true
        } catch {
            sendError = error.localizedDescription
            Self.logger.error("Foreground refresh failed: \(error.localizedDescription, privacy: .public)")
            startEventStreams(serverID: serverID)
        }
    }

    private func reloadServer(_ serverID: String) async throws {
        async let loadedChats: [ChatSummary] = client.query(
            "chat.list",
            input: ServerScopedInput(serverId: serverID)
        )
        async let loadedAgents: [AgentSummary] = client.query(
            "agent.list",
            input: ServerScopedInput(serverId: serverID)
        )
        async let loadedMembers: MemberList = client.query(
            "member.list",
            input: ServerScopedInput(serverId: serverID)
        )
        chats = try await loadedChats
        agents = try await loadedAgents
        lifecycleAvailability.removeAll()
        members = try await loadedMembers
        await reloadActiveActivity(serverID: serverID)
        await loadComputers(serverID: serverID)

        if let firstChat = chats.first {
            await loadMessages(chatID: firstChat.id)
        }
    }

    func refreshServerSnapshot(serverID: String) async throws {
        async let loadedServers: [ServerSummary] = client.query("server.list")
        async let loadedChats: [ChatSummary] = client.query(
            "chat.list",
            input: ServerScopedInput(serverId: serverID)
        )
        async let loadedAgents: [AgentSummary] = client.query(
            "agent.list",
            input: ServerScopedInput(serverId: serverID)
        )
        async let loadedMembers: MemberList = client.query(
            "member.list",
            input: ServerScopedInput(serverId: serverID)
        )
        servers = try await loadedServers
        chats = try await loadedChats
        agents = try await loadedAgents
        lifecycleAvailability.removeAll()
        members = try await loadedMembers
        await reloadActiveActivity(serverID: serverID)
        await loadComputers(serverID: serverID)

        // Keep the best cached presentation visible if one page cannot be refreshed.
        for chatID in Array(messagesByChatID.keys) {
            await loadMessages(chatID: chatID)
        }
        if let openChatID {
            await markChatReadIfNeeded(chatID: openChatID)
        }
    }

    private func startEventStreams(serverID: String) {
        stopEventStreams()
        if chatEventServerID != serverID {
            chatEventServerID = serverID
            chatEventReplay.reset()
        }

        let chatTask = Task { [weak self] in
            guard let self else { return }
            do {
                for try await event in await client.subscribe(
                    "chat.onEvent",
                    input: ServerScopedInput(serverId: serverID),
                    onConnected: { [weak self] in
                        guard let self else { return }
                        await self.catchUpChatEvents(serverID: serverID)
                    }
                ) as AsyncThrowingStream<ChatEvent, Error> {
                    guard !Task.isCancelled else { return }
                    await handle(chatEvent: event, serverID: serverID)
                }
            } catch {
                isConnected = false
            }
        }
        let lifecycleTask = Task { [weak self] in
            guard let self else { return }
            do {
                for try await event in await client.subscribe(
                    "agent.onLifecycle",
                    input: ServerScopedInput(serverId: serverID),
                    onConnected: { [weak self] in
                        await self?.reloadAgentAvailability(serverID: serverID)
                    }
                ) as AsyncThrowingStream<AgentLifecycleEvent, Error> {
                    guard !Task.isCancelled else { return }
                    handle(lifecycleEvent: event)
                }
            } catch {
                isConnected = false
            }
        }
        let activityTask = Task { [weak self] in
            guard let self else { return }
            do {
                for try await event in await client.subscribe(
                    "agent.onActivity",
                    input: ServerScopedInput(serverId: serverID),
                    onConnected: { [weak self] in
                        await self?.reloadActiveActivity(serverID: serverID)
                    }
                ) as AsyncThrowingStream<AgentActivityEvent, Error> {
                    guard !Task.isCancelled else { return }
                    handle(activityEvent: event)
                }
            } catch {
                Self.logger.warning("Agent activity stream ended: \(error.localizedDescription, privacy: .public)")
            }
        }
        eventTasks.replace(with: [
            chatTask,
            lifecycleTask,
            activityTask,
        ])
    }

    private func handle(chatEvent event: ChatEvent, serverID: String) async {
        isConnected = true
        await applyChatEvents([event], serverID: serverID)
    }

    private func handle(lifecycleEvent event: AgentLifecycleEvent) {
        isConnected = true
        lifecycleRevision += 1
        switch event.phase {
        case .working, .reading, .sending:
            if currentActivityByAgentID[event.agentID]?.runID != event.runID {
                currentActivityByAgentID.removeValue(forKey: event.agentID)
            }
            lifecycleAvailability[event.agentID] = .working
        case .settled:
            lifecycleAvailability[event.agentID] = switch event.outcome {
            case .completed: .idle
            case .failed: .error
            case .stopped: .stopped
            case nil: .idle
            }
            currentActivityByAgentID.removeValue(forKey: event.agentID)
            currentActivityPositionByRunID.removeValue(forKey: event.runID)
        }
    }

    private func reloadAgentAvailability(serverID: String) async {
        guard activeServer?.id == serverID else { return }
        let revisionAtStart = lifecycleRevision
        do {
            let refreshed: [AgentSummary] = try await client.query(
                "agent.list",
                input: ServerScopedInput(serverId: serverID)
            )
            guard activeServer?.id == serverID else { return }
            agents = refreshed
            if lifecycleRevision == revisionAtStart {
                lifecycleAvailability.removeAll()
            }
            await reloadActiveActivity(serverID: serverID)
        } catch is CancellationError {
            return
        } catch {
            Self.logger.warning("Agent availability refresh failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func stopEventStreams() {
        eventTasks.cancelAll()
    }
}
