import ClerkKit
import GrottoUI
import SwiftUI

struct AuthenticatedGrottoView: View {
    @State private var store: GrottoStore
    @State private var selectedThread: ThreadSelection?
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
                    Text(message)
                } actions: {
                    Button("Try again") { Task { await store.retry() } }
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
        if let server = store.serverPresentation, !store.chatPresentations.isEmpty {
            NavigationStack {
                GrottoShellView(
                    server: server,
                    chats: store.chatPresentations,
                    messagesForChat: { store.messagePresentations(chatID: $0.id) },
                    isConnected: store.isConnected,
                    settingsContent: {
                        if let settingsData = store.settingsData {
                            SettingsSheet(
                                data: settingsData,
                                persistence: store.settingsPersistence,
                                appearance: appearanceBinding,
                                tasksPersistence: store.settingsTasksPersistence,
                                onOpenTask: { item in
                                    guard let anchor = store.taskMessagePresentation(item) else { return }
                                    selectedThread = ThreadSelection(
                                        parentChatID: item.message.chatID,
                                        threadChatID: item.task.threadChatID,
                                        anchor: anchor
                                    )
                                }
                            )
                        } else {
                            ContentUnavailableView {
                                Label("Settings unavailable", systemImage: "gearshape")
                            } description: {
                                Text("Settings are still loading. Try again in a moment.")
                            }
                        }
                    },
                    onOpenThread: openThread,
                    onSelectChat: { chat in
                        Task { await store.openChat(chatID: chat.id) }
                    },
                    onSend: { chat, content, attachments in
                        await store.send(content, to: chat.id, attachments: attachments)
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
                    createChannel: { draft in
                        try await store.createNativeChannel(draft)
                    }
                )
                .navigationDestination(item: $selectedThread) { thread in
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

                            // Server is authoritative for the child Chat id.
                            // Usually this equals the route value; retaining the
                            // update makes a stale/prospective route converge
                            // without deriving an id on-device.
                            if resolvedThreadChatID != thread.threadChatID {
                                selectedThread?.threadChatID = resolvedThreadChatID
                            }
                            // A prospective route had no child Chat to open on
                            // arrival. Promote it to the canonical child now so
                            // subsequent sends and read acknowledgements use the
                            // same Server Chat as the transcript.
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
                    .onDisappear {
                        Task { await store.openChat(chatID: thread.parentChatID) }
                    }
                }
                .task(id: store.chatPresentations.first?.id) {
                    guard let chatID = store.chatPresentations.first?.id else { return }
                    await store.openChat(chatID: chatID)
                }
                .preferredColorScheme(preferredColorScheme)
            }
        } else {
            ContentUnavailableView(
                "No chats yet",
                systemImage: "bubble.left.and.bubble.right",
                description: Text("Create a channel or message an Agent from Grotto on desktop.")
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
        switch AppearancePreference(rawValue: appearanceRawValue) ?? .system {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    private func openThread(_ chat: ChatPresentation, _ anchor: MessagePresentation) {
        selectedThread = ThreadSelection(
            parentChatID: chat.id,
            threadChatID: anchor.thread?.threadChatID,
            anchor: anchor
        )
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

private struct ThreadSelection: Hashable, Identifiable {
    let parentChatID: String
    var threadChatID: String?
    let anchor: MessagePresentation

    var id: String { anchor.id }
}
