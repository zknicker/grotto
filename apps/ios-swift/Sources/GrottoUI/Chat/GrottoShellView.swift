import SwiftUI
import Foundation

public struct GrottoShellView<SettingsContent: View>: View {
    private let server: ServerPresentation
    let chats: [ChatPresentation]
    private let messagesForChat: (ChatPresentation) -> [MessagePresentation]
    private let isConnected: Bool
    private let settingsContent: ([SettingsRoute]) -> SettingsContent
    let onOpenTasks: () -> Void
    private let onOpenThread: (ChatPresentation, MessagePresentation) -> Void
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
    private let canManagePreparedActions: Bool
    private let onReviewPreparedCreateAgent: (PreparedCreateAgentActionPresentation) -> Void

    @Binding private var selectedChatID: String?
    @State var drawerPresented = false
    @State var settingsRequest: SettingsPresentationRequest?
    /// Settings queued behind a Chat sheet that has to dismiss first; the two
    /// sheet surfaces are mutually exclusive.
    @State var queuedSettingsRequest: SettingsPresentationRequest?
    @State var activeChatSheet: GrottoShellSheet?
    @State var pendingChatSelectionID: String?
    @State private var scrollTarget: MessageScrollTarget?
    @State var dragTranslation: CGFloat?
    @Environment(\.colorScheme) private var colorScheme

    public init(
        server: ServerPresentation,
        chats: [ChatPresentation],
        selectedChatID: Binding<String?> = .constant(nil),
        messagesForChat: @escaping (ChatPresentation) -> [MessagePresentation],
        isConnected: Bool,
        @ViewBuilder settingsContent: @escaping ([SettingsRoute]) -> SettingsContent,
        onOpenTasks: @escaping () -> Void = {},
        onOpenThread: @escaping (ChatPresentation, MessagePresentation) -> Void = { _, _ in },
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
        canManagePreparedActions: Bool = false,
        onReviewPreparedCreateAgent: @escaping (PreparedCreateAgentActionPresentation) -> Void = { _ in },
        createChannel: @escaping @Sendable (NewChannelDraft) async throws -> CreatedChannelPresentation = { _ in
            throw CancellationError()
        }
    ) {
        _selectedChatID = selectedChatID
        self.server = server
        self.chats = chats
        self.messagesForChat = messagesForChat
        self.isConnected = isConnected
        self.settingsContent = settingsContent
        self.onOpenTasks = onOpenTasks
        self.onOpenThread = onOpenThread
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
        self.canManagePreparedActions = canManagePreparedActions
        self.onReviewPreparedCreateAgent = onReviewPreparedCreateAgent
        self.createChannel = createChannel
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
                    onOpenSettings: { openSettings() },
                    onOpenSearch: { activeChatSheet = .search },
                    onOpenTasks: openTasks,
                    onOpenArchived: { activeChatSheet = .archived },
                    onOpenNewChannel: { activeChatSheet = .newChannel }
                )
                // `.mask()` below rasterizes this view into an offscreen buffer
                // sized to its own resolved height, which `.ignoresSafeArea()`
                // bleed cannot expand — so the extra room for the gear button's
                // shadow has to come from a genuinely taller proposed frame.
                // `ChatSidebarView` reserves that same extra height as inert
                // space at its own bottom, so nothing else shifts.
                .frame(
                    width: drawerWidth,
                    height: proxy.size.height + ChatSidebarView.shadowBleedHeight,
                    alignment: .top
                )
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
                        canManagePreparedActions: canManagePreparedActions,
                        onReviewPreparedCreateAgent: onReviewPreparedCreateAgent,
                        hasOlderMessages: hasOlderMessages(selectedChat),
                        isLoadingOlderMessages: isLoadingOlderMessages(selectedChat),
                        onLoadOlderMessages: { await onLoadOlderMessages(selectedChat) },
                        contentInsets: proxy.safeAreaInsets,
                        scrollTargetMessageID: scrollTargetBinding(for: selectedChat)
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
        .sheet(item: $settingsRequest) { request in settingsContent(request.path) }
        .sheet(item: $activeChatSheet, onDismiss: presentQueuedSettings) { sheet in
            switch sheet {
            case .search:
                ServerSearchView(
                    chats: chats,
                    searchMessages: searchMessages,
                    onSelectChat: { open($0) },
                    onSelectMessage: openSearchResult
                )
            case .archived:
                ArchivedChannelsView(
                    load: loadArchivedChannels,
                    restore: restoreArchivedChannel,
                    onRestored: selectRestoredChannel
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
                    currentActivity: agentActivity(for: chat),
                    loadAgentActivity: loadAgentActivity,
                    onOpenAgentProfile: openAgentProfile
                )
            }
        }
        .onChange(of: chats.map(\.id), initial: true) { _, chatIDs in
            syncSelection(chatIDs: chatIDs)
        }
    }

    private var selectedChat: ChatPresentation? {
        chats.first { $0.id == selectedChatID } ?? chats.first
    }

    /// Adopts a requested Chat once the Server list carries it, and keeps a
    /// removed selection from lingering as a stale id behind the rendered Chat.
    private func syncSelection(chatIDs: [String]) {
        if let arrivedID = ChatSelection.resolvePending(pendingID: pendingChatSelectionID, chatIDs: chatIDs),
           let arrivedChat = chats.first(where: { $0.id == arrivedID }) {
            pendingChatSelectionID = nil
            selectChat(arrivedChat)
            return
        }

        let resolved = ChatSelection.resolve(selectedID: selectedChatID, chatIDs: chatIDs)
        guard resolved != selectedChatID else { return }
        selectedChatID = resolved
    }

    private func scrollTargetBinding(for chat: ChatPresentation) -> Binding<String?> {
        Binding(
            get: { scrollTarget?.chatID == chat.id ? scrollTarget?.messageID : nil },
            set: { if $0 == nil { scrollTarget = nil } }
        )
    }

    private func agentActivity(for chat: ChatPresentation) -> AgentActivityPresentation? {
        guard case .directMessage(let agent) = chat.kind else { return nil }
        return agentActivities[agent.id]
    }

    private func selectChat(_ chat: ChatPresentation) {
        if pendingChatSelectionID != chat.id {
            pendingChatSelectionID = nil
        }
        selectedChatID = chat.id
        setDrawer(open: false)
    }

    /// The one path a sheet uses to reach a Chat, so every sheet dismisses and
    /// selects in the same order.
    func open(_ chat: ChatPresentation, revealing messageID: String? = nil) {
        activeChatSheet = nil
        scrollTarget = messageID.map { MessageScrollTarget(chatID: chat.id, messageID: $0) }
        selectChat(chat)
    }

    private func openSearchResult(_ result: MessageSearchResultPresentation) -> Bool {
        guard let chat = chats.first(where: { $0.id == result.chatID }) else { return false }
        open(chat, revealing: result.id)
        return true
    }

}

#Preview {
    @Previewable @State var selectedChatID: String? = ChatFixtures.chats.first?.id

    GrottoShellView(
        server: ChatFixtures.server,
        chats: ChatFixtures.chats,
        selectedChatID: $selectedChatID,
        messagesForChat: { _ in ChatFixtures.messages },
        isConnected: true,
        settingsContent: { path in
            SettingsSheet(initialPath: path)
        },
        onSend: { _, _, _ in true }
    )
}
