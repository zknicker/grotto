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
    // Internal so the lifecycle overlay can live in its own file.
    var lifecycleAvailability: [String: AgentAvailability] = [:]
    var currentActivityByAgentID: [String: AgentActivityEvent] = [:]
    var currentActivityPositionByRunID: [String: Int] = [:]
    var lifecycleRevision = 0
    var sendError: String?
    var chatEventServerID: String?
    var chatEventReplay = ChatEventReplayState()
    var chatEventCatchUpInFlight = false
    var chatEventCatchUpPending = false
    var openChatID: String?
    var acknowledgedReadSequences: [ChatReadScope: Int] = [:]
    var readAcknowledgementsInFlight: Set<ChatReadAcknowledgement> = []
    var olderMessageLoadsInFlight: Set<String> = []
    /// Live SSE events accumulate here for one short window before the existing
    /// batch applier runs; the catch-up walk already arrives batched.
    @ObservationIgnored var liveChatEvents = ChatEventCoalescer()
    @ObservationIgnored var liveChatEventFlush: Task<Void, Never>?
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
    /// Subscriptions are notification streams, not a durable history. Refetching
    /// the canonical lists and the open message page prevents a foregrounded app
    /// from presenting a stale cache while the streams reconnect.
    ///
    /// This is a voluntary refresh, so it keeps the connected state: dropping it
    /// slid the offline banner over the composer on every single foreground.
    /// Offline is what a failed refresh or a broken stream reports.
    func resumeAfterForeground() async {
        guard case .loaded = state,
              !foregroundRefreshInFlight,
              let serverID = activeServer?.id
        else { return }

        foregroundRefreshInFlight = true
        defer { foregroundRefreshInFlight = false }
        stopEventStreams()

        do {
            try await refreshServerSnapshot(serverID: serverID)
            startEventStreams(serverID: serverID)
            markConnected()
        } catch {
            isConnected = false
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
        if !lifecycleAvailability.isEmpty { lifecycleAvailability.removeAll() }
        members = try await loadedMembers
        await reloadActiveActivity(serverID: serverID)
        await loadComputers(serverID: serverID)

        if let firstChat = chats.first {
            await loadMessages(chatID: firstChat.id)
        }
    }

    /// Reads the durable Server projections concurrently and applies them in one
    /// pass, so a foreground or reconnect lands as a single repaint rather than
    /// a stagger of half-updated lists.
    func refreshServerSnapshot(serverID: String) async throws {
        let lifecycleRevisionAtStart = lifecycleRevision
        let snapshot = try await fetchServerSnapshot(serverID: serverID)
        apply(snapshot, lifecycleRevisionAtStart: lifecycleRevisionAtStart)

        // Only the open Chat's page is refetched eagerly. Every other cached
        // page is refreshed by the event walk that follows this snapshot, by
        // live events, and by `openChat` when the user navigates back to it.
        if let openChatID {
            await loadMessages(chatID: openChatID)
            await markChatReadIfNeeded(chatID: openChatID)
        }
    }

    private func apply(_ snapshot: ServerSnapshot, lifecycleRevisionAtStart: Int) {
        if servers != snapshot.servers { servers = snapshot.servers }
        if chats != snapshot.chats { chats = snapshot.chats }
        if agents != snapshot.agents { agents = snapshot.agents }
        if members != snapshot.members { members = snapshot.members }
        // The live overlay outranks `agent.list` only when a lifecycle event
        // landed while the snapshot was in flight. Clearing it unconditionally
        // traded live presence for a list read that may already be older.
        clearLifecycleAvailability(ifRevisionIs: lifecycleRevisionAtStart)
        // Activity is derived from the Agent list and its availability, so it
        // applies after both.
        if let activity = snapshot.activity {
            replaceActiveActivitySnapshot(activity)
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
                // A cancelled stream is a teardown we asked for, not an outage.
                guard !Task.isCancelled else { return }
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
                guard !Task.isCancelled else { return }
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
        markConnected()
        await bufferLiveChatEvent(event, serverID: serverID)
    }

    /// Observation notifies on equal-value writes, so the event paths must not
    /// restate a connection they already have: doing so invalidated the root
    /// body once per SSE frame.
    func markConnected() {
        if !isConnected { isConnected = true }
    }

    private func stopEventStreams() {
        flushLiveChatEventsBeforeTeardown()
        eventTasks.cancelAll()
    }
}
