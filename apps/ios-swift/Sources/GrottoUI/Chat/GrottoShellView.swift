import SwiftUI
import Foundation

public struct GrottoShellView<SettingsContent: View>: View {
    private let server: ServerPresentation
    private let chats: [ChatPresentation]
    private let messagesForChat: (ChatPresentation) -> [MessagePresentation]
    private let isConnected: Bool
    private let settingsContent: () -> SettingsContent
    private let onOpenThread: (ChatPresentation, MessagePresentation) -> Void
    private let onSelectChat: (ChatPresentation) -> Void
    private let onSend: (ChatPresentation, String, [ComposerAttachment]) async -> Bool
    private let onOpenAttachment: (MessageAttachmentPresentation) async throws -> URL
    private let hasOlderMessages: (ChatPresentation) -> Bool
    private let isLoadingOlderMessages: (ChatPresentation) -> Bool
    private let onLoadOlderMessages: (ChatPresentation) async -> Bool
    private let searchMessages: @Sendable (String) async throws -> [MessageSearchResultPresentation]
    private let loadArchivedChannels: @Sendable () async throws -> [ArchivedChannelPresentation]
    private let restoreArchivedChannel: @Sendable (ArchivedChannelPresentation) async throws -> Void
    private let newChannelAgents: [NewChannelAgentPresentation]
    private let createChannel: @Sendable (NewChannelDraft) async throws -> CreatedChannelPresentation
    private let agentActivities: [String: AgentActivityPresentation]
    private let loadAgentActivity: @Sendable (String) async throws -> [AgentActivityPresentation]

    @State private var selectedChatID: String?
    @State private var drawerPresented = false
    @State private var settingsPresented = false
    @State private var activeChatSheet: ChatSheet?
    @State private var pendingCreatedChatID: String?
    @State private var dragTranslation: CGFloat?
    @Environment(\.colorScheme) private var colorScheme

    public init(
        server: ServerPresentation,
        chats: [ChatPresentation],
        messagesForChat: @escaping (ChatPresentation) -> [MessagePresentation],
        isConnected: Bool,
        @ViewBuilder settingsContent: @escaping () -> SettingsContent,
        onOpenThread: @escaping (ChatPresentation, MessagePresentation) -> Void = { _, _ in },
        onSelectChat: @escaping (ChatPresentation) -> Void = { _ in },
        onSend: @escaping (ChatPresentation, String, [ComposerAttachment]) async -> Bool,
        onOpenAttachment: @escaping (MessageAttachmentPresentation) async throws -> URL = { attachment in
            guard let localURL = attachment.localURL else { throw CancellationError() }
            return localURL
        },
        hasOlderMessages: @escaping (ChatPresentation) -> Bool = { _ in false },
        isLoadingOlderMessages: @escaping (ChatPresentation) -> Bool = { _ in false },
        onLoadOlderMessages: @escaping (ChatPresentation) async -> Bool = { _ in false },
        searchMessages: @escaping @Sendable (String) async throws -> [MessageSearchResultPresentation] = { _ in [] },
        loadArchivedChannels: @escaping @Sendable () async throws -> [ArchivedChannelPresentation] = { [] },
        restoreArchivedChannel: @escaping @Sendable (ArchivedChannelPresentation) async throws -> Void = { _ in },
        newChannelAgents: [NewChannelAgentPresentation] = [],
        agentActivities: [String: AgentActivityPresentation] = [:],
        loadAgentActivity: @escaping @Sendable (String) async throws -> [AgentActivityPresentation] = { _ in [] },
        createChannel: @escaping @Sendable (NewChannelDraft) async throws -> CreatedChannelPresentation = { _ in
            throw CancellationError()
        }
    ) {
        self.server = server
        self.chats = chats
        self.messagesForChat = messagesForChat
        self.isConnected = isConnected
        self.settingsContent = settingsContent
        self.onOpenThread = onOpenThread
        self.onSelectChat = onSelectChat
        self.onSend = onSend
        self.onOpenAttachment = onOpenAttachment
        self.hasOlderMessages = hasOlderMessages
        self.isLoadingOlderMessages = isLoadingOlderMessages
        self.onLoadOlderMessages = onLoadOlderMessages
        self.searchMessages = searchMessages
        self.loadArchivedChannels = loadArchivedChannels
        self.restoreArchivedChannel = restoreArchivedChannel
        self.newChannelAgents = newChannelAgents
        self.agentActivities = agentActivities
        self.loadAgentActivity = loadAgentActivity
        self.createChannel = createChannel
        _selectedChatID = State(initialValue: chats.first?.id)
    }

    public var body: some View {
        GeometryReader { proxy in
            let drawerWidth = min(proxy.size.width * 0.82, 340)
            ZStack(alignment: .leading) {
                ChatSidebarView(
                    server: server,
                    chats: chats,
                    selectedChatID: selectedChat?.id,
                    onSelectChat: selectChat,
                    onOpenSettings: openSettings,
                    onOpenSearch: { activeChatSheet = .search },
                    onOpenArchived: { activeChatSheet = .archived },
                    onOpenNewChannel: { activeChatSheet = .newChannel }
                )
                .frame(width: drawerWidth)
                .offset(x: -(1 - drawerProgress(drawerWidth: drawerWidth)) * drawerWidth * 0.22)
                .mask(alignment: .leading) {
                    Rectangle().frame(width: canvasOffset(drawerWidth: drawerWidth))
                }
                .allowsHitTesting(drawerPresented)
                .zIndex(1)

                if let selectedChat {
                    ChatScreenView(
                        chat: selectedChat,
                        messages: messagesForChat(selectedChat),
                        isConnected: isConnected,
                        onOpenSidebar: { setDrawer(open: !drawerPresented) },
                        onOpenChatDetails: { activeChatSheet = .details(selectedChat) },
                        onOpenSearch: { activeChatSheet = .search },
                        onOpenThread: { onOpenThread(selectedChat, $0) },
                        onSend: { await onSend(selectedChat, $0, $1) },
                        onOpenAttachment: onOpenAttachment,
                        hasOlderMessages: hasOlderMessages(selectedChat),
                        isLoadingOlderMessages: isLoadingOlderMessages(selectedChat),
                        onLoadOlderMessages: { await onLoadOlderMessages(selectedChat) },
                        contentInsets: proxy.safeAreaInsets
                    )
                    .overlay {
                        let progress = drawerProgress(drawerWidth: drawerWidth)
                        if progress > 0 {
                            GrottoDrawerVeil.color(for: colorScheme)
                                .opacity(GrottoDrawerVeil.opacity(for: colorScheme, progress: progress))
                                .contentShape(.rect)
                                .allowsHitTesting(drawerPresented)
                                .onTapGesture { setDrawer(open: false) }
                        }
                    }
                    // The veil is shaped and expanded with the canvas it covers,
                    // so it carries the same corners and the same full height.
                    .clipShape(.rect(cornerRadius: canvasCornerRadius(drawerWidth: drawerWidth)))
                    .ignoresSafeArea()
                    .shadow(
                        color: .black.opacity(0.13 * drawerProgress(drawerWidth: drawerWidth)),
                        radius: 20,
                        x: -6
                    )
                    .offset(x: canvasOffset(drawerWidth: drawerWidth))
                    .zIndex(2)
                    .drawerPan(isOpen: drawerPresented) { pan in
                        handleDrawerPan(pan, drawerWidth: drawerWidth)
                    }
                }
            }
            .background(GrottoPlatformColor.background)
        }
        .sheet(isPresented: $settingsPresented) { settingsContent() }
        .sheet(item: $activeChatSheet) { sheet in
            switch sheet {
            case .search:
                ServerSearchView(
                    chats: chats,
                    searchMessages: searchMessages,
                    onSelectChat: { chat in
                        activeChatSheet = nil
                        selectChat(chat)
                    },
                    onSelectMessage: selectSearchResult
                )
            case .archived:
                ArchivedChannelsView(
                    load: loadArchivedChannels,
                    restore: restoreArchivedChannel
                )
            case .newChannel:
                NewChannelFormView(
                    agents: newChannelAgents,
                    create: createChannel,
                    onCreated: selectCreatedChannel
                )
            case .details(let chat):
                ChatDetailsView(
                    chat: chat,
                    server: server,
                    isConnected: isConnected,
                    currentActivity: agentActivity(for: chat),
                    loadAgentActivity: loadAgentActivity
                )
            }
        }
        .onChange(of: chats.map(\.id)) { _, _ in
            guard let pendingCreatedChatID,
                  let createdChat = chats.first(where: { $0.id == pendingCreatedChatID })
            else { return }
            self.pendingCreatedChatID = nil
            selectChat(createdChat)
        }
    }

    private var selectedChat: ChatPresentation? {
        chats.first { $0.id == selectedChatID } ?? chats.first
    }

    private func agentActivity(for chat: ChatPresentation) -> AgentActivityPresentation? {
        guard case .directMessage(let agent) = chat.kind else { return nil }
        return agentActivities[agent.id]
    }

    private func canvasOffset(drawerWidth: CGFloat) -> CGFloat {
        guard let dragTranslation else { return drawerPresented ? drawerWidth : 0 }
        return DrawerInteraction.offset(
            isOpen: drawerPresented,
            translation: dragTranslation,
            width: drawerWidth
        )
    }

    private func canvasCornerRadius(drawerWidth: CGFloat) -> CGFloat {
        38 * drawerProgress(drawerWidth: drawerWidth)
    }

    private func drawerProgress(drawerWidth: CGFloat) -> CGFloat {
        guard drawerWidth > 0 else { return 0 }
        return min(1, max(0, canvasOffset(drawerWidth: drawerWidth) / drawerWidth))
    }

    private func handleDrawerPan(_ pan: DrawerPan, drawerWidth: CGFloat) {
        switch pan {
        case .changed(let translation):
            dragTranslation = translation
        case .ended(let translation, let velocity):
            let offset = DrawerInteraction.offset(
                isOpen: drawerPresented,
                translation: translation,
                width: drawerWidth
            )
            let opens = DrawerInteraction.settlesOpen(
                offset: offset,
                velocity: velocity,
                width: drawerWidth
            )
            let settleVelocity = DrawerInteraction.settleVelocity(
                velocity: velocity,
                offset: offset,
                target: opens ? drawerWidth : 0
            )
            withAnimation(.interpolatingSpring(duration: 0.38, bounce: 0.06, initialVelocity: settleVelocity)) {
                dragTranslation = nil
                drawerPresented = opens
            }
        }
    }

    private func setDrawer(open: Bool) {
        withAnimation(.interpolatingSpring(duration: 0.38, bounce: 0.06)) {
            dragTranslation = nil
            drawerPresented = open
        }
    }

    private func selectChat(_ chat: ChatPresentation) {
        selectedChatID = chat.id
        onSelectChat(chat)
        setDrawer(open: false)
    }

    private func selectSearchResult(_ result: MessageSearchResultPresentation) {
        guard let chat = chats.first(where: { $0.id == result.chatID }) else {
            activeChatSheet = nil
            return
        }
        selectChat(chat)
        activeChatSheet = nil
    }

    private func selectCreatedChannel(_ channel: CreatedChannelPresentation) {
        pendingCreatedChatID = channel.id
        activeChatSheet = nil
        if let createdChat = chats.first(where: { $0.id == channel.id }) {
            pendingCreatedChatID = nil
            selectChat(createdChat)
        }
    }

    private func openSettings() {
        setDrawer(open: false)
        settingsPresented = true
    }

    private enum ChatSheet: Identifiable {
        case search
        case details(ChatPresentation)
        case archived
        case newChannel

        var id: String {
            switch self {
            case .search:
                "chat-search"
            case .details(let chat):
                "chat-details-\(chat.id)"
            case .archived:
                "archived-channels"
            case .newChannel:
                "new-channel"
            }
        }
    }
}

#Preview {
    GrottoShellView(
        server: ChatFixtures.server,
        chats: ChatFixtures.chats,
        messagesForChat: { _ in ChatFixtures.messages },
        isConnected: true,
        settingsContent: {
            SettingsSheet(tasksPersistence: .preview)
        },
        onSend: { _, _, _ in true }
    )
}
