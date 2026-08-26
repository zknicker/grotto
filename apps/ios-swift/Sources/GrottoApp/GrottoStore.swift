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
    // Internal so the batched snapshot apply can live with the rest of the
    // realtime plumbing.
    var servers: [ServerSummary] = []
    // Internal so the app-only computer loader can live in its own file.
    var computers: [ComputerSummary]?
    var mentionOptionsByDestinationID: [ChatDestination.ID: [MentionOptionPresentation]] = [:]
    var currentActivityByAgentID: [String: AgentActivityEvent] = [:]
    var currentActivityPositionByRunID: [String: Int] = [:]
    var lifecycleRevision = 0
    // Everything the memoized Chat projections read is stored here and
    // published through the accessors under "Projected Server state" below.
    private var storedAgents: [AgentSummary] = []
    private var storedMembers: MemberList?
    private var storedChats: [ChatSummary] = []
    private var storedReceiptBackedAgentDMsByChatID: [String: String] = [:]
    private var storedMessagesByChatID: [String: ChatMessagePage] = [:]
    private var storedPendingMessagesByChatID: [String: [PendingChatMessage]] = [:]
    private var storedLifecycleAvailability: [String: AgentAvailability] = [:]
    var sendError: String?
    var chatEventServerID: String?
    var chatEventReplay = ChatEventReplayState()
    var chatEventCatchUpInFlight = false
    var chatEventCatchUpPending = false
    /// The deepest Chat surface on the user's stack, and the only Chat that
    /// acknowledges reads: it is what the user is actually looking at.
    var openChatID: String?
    /// The Chat the shell canvas is showing, whether or not a pushed route
    /// covers it. A covered canvas is still a surface the user will return to,
    /// so its page has to stay fresh — but it never acknowledges reads, which
    /// stay with `openChatID`.
    var canvasChatID: String?
    /// Memoized Chat projections. Cache writes must stay invisible to
    /// Observation: a projection read happens inside a view body, and a tracked
    /// write there would invalidate the body that just performed it.
    @ObservationIgnored var projections = ChatProjectionCaches()
    var acknowledgedReadSequences: [ChatReadScope: Int] = [:]
    var readAcknowledgementsInFlight: Set<ChatReadAcknowledgement> = []
    var olderMessageLoadsInFlight: Set<String> = []
    /// Live SSE events accumulate here for one short window before the existing
    /// batch applier runs; the catch-up walk already arrives batched.
    @ObservationIgnored var liveChatEvents = ChatEventCoalescer()
    @ObservationIgnored var liveChatEventFlush: Task<Void, Never>?
    // Internal so the foreground refresh can live with the rest of the
    // realtime plumbing it drives.
    var foregroundRefreshInFlight = false
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

    func startEventStreams(serverID: String) {
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
                markDisconnected()
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
                markDisconnected()
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

    /// Observation notifies on equal-value writes, so the event paths must not
    /// restate a connection they already have: doing so invalidated the root
    /// body once per SSE frame. `markDisconnected` is the same rule for the
    /// paths that observe an outage.
    func markConnected() {
        if !isConnected { isConnected = true }
    }

    func markDisconnected() {
        if isConnected { isConnected = false }
    }

    func stopEventStreams() {
        flushLiveChatEventsBeforeTeardown()
        eventTasks.cancelAll()
    }

    // MARK: - Projected Server state
    //
    // The Chat projections are memoized, and these fields are their inputs. Each
    // one is stored privately and published through the accessor below it, so
    // the invalidation contract holds structurally rather than by convention: a
    // write cannot reach this state without passing through a setter that
    // retires the projections that field feeds.
    //
    // The setters also drop equal-value writes. Observation reports those as
    // changes, and every event path here refetches lists that usually come back
    // byte-identical.

    /// Names, avatars, and presence for every Agent-authored row, mention, and
    /// sidebar entry, so an Agent write retires both projections.
    var agents: [AgentSummary] {
        get { storedAgents }
        set {
            guard storedAgents != newValue else { return }
            storedAgents = newValue
            projections.retireDirectoryProjections()
        }
    }

    /// Names and avatars for human authors, mentions, and human DMs.
    var members: MemberList? {
        get { storedMembers }
        set {
            guard storedMembers != newValue else { return }
            storedMembers = newValue
            projections.retireDirectoryProjections()
        }
    }

    /// The live presence overlay. It reaches message rows through the author's
    /// presence dot and sidebar rows through the Agent's, so it counts as part
    /// of the directory.
    var lifecycleAvailability: [String: AgentAvailability] {
        get { storedLifecycleAvailability }
        set {
            guard storedLifecycleAvailability != newValue else { return }
            storedLifecycleAvailability = newValue
            projections.retireDirectoryProjections()
        }
    }

    var chats: [ChatSummary] {
        get { storedChats }
        set {
            guard storedChats != newValue else { return }
            storedChats = newValue
            projections.retireChatListProjection()
        }
    }

    /// Agent DMs Server has materialized but the Chat list has not caught up to.
    var receiptBackedAgentDMsByChatID: [String: String] {
        get { storedReceiptBackedAgentDMsByChatID }
        set {
            guard storedReceiptBackedAgentDMsByChatID != newValue else { return }
            storedReceiptBackedAgentDMsByChatID = newValue
            projections.retireChatListProjection()
        }
    }

    var messagesByChatID: [String: ChatMessagePage] {
        get { storedMessagesByChatID }
        set {
            guard storedMessagesByChatID != newValue else { return }
            storedMessagesByChatID = newValue
            projections.retireMessageProjections()
        }
    }

    var pendingMessagesByChatID: [String: [PendingChatMessage]] {
        get { storedPendingMessagesByChatID }
        set {
            guard storedPendingMessagesByChatID != newValue else { return }
            storedPendingMessagesByChatID = newValue
            projections.retireMessageProjections()
        }
    }
}
