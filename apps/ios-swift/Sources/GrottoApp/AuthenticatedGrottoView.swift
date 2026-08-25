import ClerkKit
import GrottoModels
import GrottoUI
import SwiftUI

struct AuthenticatedGrottoView: View {
    @State private var store: GrottoStore
    /// The mutable mirror of the pushed Thread route. The route value itself
    /// stays stable so adopting a Server child Chat id cannot remount the
    /// screen mid-conversation.
    @State private var selectedThread: ThreadSelection?
    /// The App owns the open Chat so the shell canvas, the pushed Thread, and
    /// the Store's read acknowledgements always name the same Chat.
    @State private var selectedDestinationID: ChatDestination.ID?
    @State private var path: [GrottoRootRoute] = []
    @AppStorage("appearancePreference") private var appearanceRawValue = AppearancePreference.system.rawValue
    @Environment(\.scenePhase) private var scenePhase

    init(clerk: Clerk) {
        _store = State(initialValue: GrottoStore(clerk: clerk))
    }

    var body: some View {
        Group {
            switch store.state {
            case .idle, .loading:
                ProgressView("Opening Grotto…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed(let message):
                ContentUnavailableView {
                    Label("Grotto is unavailable", systemImage: "wifi.exclamationmark")
                } description: {
                    VStack(spacing: 4) {
                        Text("Grotto couldn't reach your Server. Check your connection and try again.")
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.tertiary)
                    }
                } actions: {
                    Button("Try again") { Task { await store.retry() } }
                        .buttonStyle(.borderedProminent)
                }
            case .loaded:
                loadedContent
            }
        }
        .task { await store.start() }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await store.resumeAfterForeground() }
        }
    }

    @ViewBuilder
    private var loadedContent: some View {
        if let server = store.serverPresentation, !store.chatDestinations.isEmpty {
            NavigationStack(path: $path) {
                GrottoShellView(
                    server: server,
                    destinations: store.chatDestinations,
                    selectedDestinationID: $selectedDestinationID,
                    messagesForDestination: { store.messagePresentations(chatID: $0.pendingKey) },
                    isConnected: store.isConnected,
                    settingsContent: { initialPath in
                        if let settingsData = store.settingsData {
                            SettingsSheet(
                                data: settingsData,
                                persistence: store.settingsPersistence,
                                appearance: appearanceBinding,
                                initialPath: initialPath
                            )
                        } else {
                            SettingsUnavailableSheet()
                        }
                    },
                    onOpenTasks: { path.append(.tasks) },
                    onOpenThread: openThread,
                    onSend: { destination, content, attachments in
                        switch destination {
                        case .durableChat(let chat):
                            return await store.send(content, to: chat.id, attachments: attachments)
                        case .implicitAgentDM(let agent):
                            guard attachments.isEmpty,
                                  let chatID = await store.sendAgentDM(content, to: agent.id) else {
                                return false
                            }
                            selectedDestinationID = .chat(chatID)
                            return true
                        }
                    },
                    onOpenAttachment: { attachment in
                        try await store.downloadAttachment(attachment)
                    },
                    hasOlderMessages: { chat in
                        store.hasOlderMessages(chatID: chat.id)
                    },
                    isLoadingOlderMessages: { chat in
                        store.isLoadingOlderMessages(chatID: chat.id)
                    },
                    onLoadOlderMessages: { chat in
                        await store.loadOlderMessages(chatID: chat.id)
                    },
                    searchMessages: { query in
                        try await store.searchMessagePresentations(query: query)
                    },
                    loadArchivedChannels: {
                        guard let serverID = await store.activeServer?.id else {
                            throw GrottoStoreError.serverUnavailable
                        }
                        return try await store.archivedChannelPresentations(serverID: serverID)
                    },
                    restoreArchivedChannel: { channel in
                        guard let serverID = await store.activeServer?.id else {
                            throw GrottoStoreError.serverUnavailable
                        }
                        _ = try await store.unarchiveChannel(
                            chatID: channel.id,
                            serverID: serverID
                        )
                    },
                    newChannelAgents: store.newChannelAgentPresentations,
                    agentActivities: store.currentAgentActivityPresentations,
                    loadAgentActivity: { agentID in
                        try await store.agentActivityPresentations(agentID: agentID)
                    },
                    mentionOptions: { store.mentionOptions(for: $0) },
                    loadMentionOptions: { await store.loadMentionOptions(for: $0) },
                    createChannel: { draft in
                        try await store.createNativeChannel(draft)
                    }
                )
                .grottoHiddenNavigationBar()
                .navigationDestination(for: GrottoRootRoute.self) { route in
                    switch route {
                    case .tasks:
                        TaskListDestinationView(
                            persistence: store.settingsTasksPersistence,
                            onOpenTask: openTask
                        )
                    case .thread(let thread):
                        threadDestination(thread)
                    }
                }
                .onChange(of: path) { previous, current in
                    guard !current.carriesThread else { return }
                    selectedThread = nil
                    // The shell selection is the source of truth for what the
                    // canvas shows once a Thread pops.
                    guard previous.carriesThread,
                          case .chat(let chatID) = selectedDestinationID else { return }
                    Task { await store.openChat(chatID: chatID) }
                }
                .onChange(of: selectedDestinationID) { _, destinationID in
                    // A pushed Thread owns the open Chat while it is on screen.
                    guard selectedThread == nil,
                          case .chat(let chatID) = destinationID else { return }
                    Task { await store.openChat(chatID: chatID) }
                }
                .preferredColorScheme(preferredColorScheme)
            }
        } else {
            ContentUnavailableView(
                "No chats yet",
                systemImage: "bubble.left.and.bubble.right",
                description: Text("Create a channel from the sidebar, or message an Agent once one joins this Server.")
            )
        }
    }

    private var appearanceBinding: Binding<AppearancePreference> {
        Binding(
            get: { AppearancePreference(rawValue: appearanceRawValue) ?? .system },
            set: { appearanceRawValue = $0.rawValue }
        )
    }

    private var preferredColorScheme: ColorScheme? {
        (AppearancePreference(rawValue: appearanceRawValue) ?? .system).colorScheme
    }

    private func openThread(_ chat: ChatPresentation, _ anchor: MessagePresentation) {
        pushThread(
            ThreadSelection(
                parentChatID: chat.id,
                threadChatID: anchor.thread?.threadChatID,
                anchor: anchor
            ),
            parentChatID: chat.id
        )
    }

    /// Opening a Task is one move: the parent Chat selection and the Thread push
    /// have to happen together, or popping the Thread lands on whichever Chat
    /// was selected before.
    private func openTask(_ item: TaskListItem) {
        guard let anchor = store.taskMessagePresentation(item) else { return }
        pushThread(
            ThreadSelection(
                parentChatID: item.message.chatID,
                threadChatID: item.task.threadChatID,
                anchor: anchor
            ),
            parentChatID: item.message.chatID
        )
    }

    private func pushThread(_ thread: ThreadSelection, parentChatID: String) {
        selectedDestinationID = .chat(parentChatID)
        selectedThread = thread
        path.append(.thread(thread))
    }

    /// The pushed Thread screen. It owns the open Chat while it is on screen,
    /// which is why the selection sync above stands down for it.
    @ViewBuilder
    private func threadDestination(_ thread: ThreadSelection) -> some View {
        ThreadDetailView(
            anchor: thread.anchor,
            replies: {
                let chatID = resolvedThreadChatID(for: thread)
                    ?? store.pendingThreadChatID(anchorMessageID: thread.anchor.id)
                return store.messagePresentations(chatID: chatID)
            },
            isConnected: store.isConnected,
            allowsAttachments: resolvedThreadChatID(for: thread) != nil,
            onSend: { content, attachments in
                let attachmentChatID = resolvedThreadChatID(for: thread)
                guard let resolvedThreadChatID = await store.sendThreadReply(
                    content,
                    to: thread.parentChatID,
                    anchorMessageID: thread.anchor.id,
                    pendingChatID: thread.threadChatID
                        ?? store.pendingThreadChatID(anchorMessageID: thread.anchor.id),
                    attachments: attachments,
                    attachmentChatID: attachmentChatID
                ) else { return false }

                // Server is authoritative for the child Chat id. Usually this
                // equals the route value; retaining the update makes a
                // stale/prospective route converge without deriving an id
                // on-device.
                if resolvedThreadChatID != thread.threadChatID {
                    selectedThread?.threadChatID = resolvedThreadChatID
                }
                // A prospective route had no child Chat to open on arrival.
                // Promote it to the canonical child now so subsequent sends and
                // read acknowledgements use the same Server Chat as the
                // transcript.
                if selectedThread?.id == thread.id {
                    await store.openChat(chatID: resolvedThreadChatID)
                }
                return true
            },
            onOpenAttachment: { attachment in
                try await store.downloadAttachment(attachment)
            },
            hasOlderReplies: resolvedThreadChatID(for: thread).map(store.hasOlderMessages) ?? false,
            isLoadingOlderReplies: resolvedThreadChatID(for: thread).map(store.isLoadingOlderMessages) ?? false,
            onLoadOlderReplies: {
                guard let chatID = resolvedThreadChatID(for: thread) else { return false }
                return await store.loadOlderMessages(chatID: chatID)
            }
        )
        .task {
            guard let chatID = resolvedThreadChatID(for: thread) else { return }
            await store.openChat(chatID: chatID)
        }
    }

    private func resolvedThreadChatID(for thread: ThreadSelection) -> String? {
        selectedThread?.id == thread.id
            ? selectedThread?.threadChatID ?? store.threadChatID(
                parentChatID: thread.parentChatID,
                anchorMessageID: thread.anchor.id
            )
            : thread.threadChatID ?? store.threadChatID(
                parentChatID: thread.parentChatID,
                anchorMessageID: thread.anchor.id
            )
    }

}
