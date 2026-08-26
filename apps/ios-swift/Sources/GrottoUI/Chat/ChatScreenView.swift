import SwiftUI

public struct ChatScreenView: View {
    private let chat: ChatPresentation
    private let messages: [MessagePresentation]
    private let isConnected: Bool
    private let onOpenSidebar: () -> Void
    private let onOpenChatDetails: () -> Void
    private let onOpenSearch: () -> Void
    private let onOpenThread: (MessagePresentation) -> Void
    private let onSend: (String, [ComposerAttachment]) async -> Bool
    private let onOpenAttachment: (MessageAttachmentPresentation) async throws -> URL
    private let canManagePreparedActions: Bool
    private let onReviewPreparedCreateAgent: (PreparedCreateAgentActionPresentation) -> Void
    private let hasOlderMessages: Bool
    private let isLoadingOlderMessages: Bool
    private let onLoadOlderMessages: () async -> Bool
    private let contentInsets: EdgeInsets

    @Binding private var scrollTargetMessageID: String?
    @State private var draft = ""
    @State private var composerInteraction = ComposerInteraction()
    @FocusState private var isComposerFocused: Bool
    @Namespace private var composerTransitionNamespace

    public init(
        chat: ChatPresentation,
        messages: [MessagePresentation],
        isConnected: Bool,
        onOpenSidebar: @escaping () -> Void,
        onOpenChatDetails: @escaping () -> Void,
        onOpenSearch: @escaping () -> Void,
        onOpenThread: @escaping (MessagePresentation) -> Void,
        onSend: @escaping (String, [ComposerAttachment]) async -> Bool,
        onOpenAttachment: @escaping (MessageAttachmentPresentation) async throws -> URL = { attachment in
            guard let localURL = attachment.localURL else { throw CancellationError() }
            return localURL
        },
        canManagePreparedActions: Bool = false,
        onReviewPreparedCreateAgent: @escaping (PreparedCreateAgentActionPresentation) -> Void = { _ in },
        hasOlderMessages: Bool = false,
        isLoadingOlderMessages: Bool = false,
        onLoadOlderMessages: @escaping () async -> Bool = { false },
        contentInsets: EdgeInsets = EdgeInsets(),
        scrollTargetMessageID: Binding<String?> = .constant(nil)
    ) {
        _scrollTargetMessageID = scrollTargetMessageID
        self.chat = chat
        self.messages = messages
        self.isConnected = isConnected
        self.onOpenSidebar = onOpenSidebar
        self.onOpenChatDetails = onOpenChatDetails
        self.onOpenSearch = onOpenSearch
        self.onOpenThread = onOpenThread
        self.onSend = onSend
        self.onOpenAttachment = onOpenAttachment
        self.canManagePreparedActions = canManagePreparedActions
        self.onReviewPreparedCreateAgent = onReviewPreparedCreateAgent
        self.hasOlderMessages = hasOlderMessages
        self.isLoadingOlderMessages = isLoadingOlderMessages
        self.onLoadOlderMessages = onLoadOlderMessages
        self.contentInsets = contentInsets
    }

    public var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottomLeading) {
                VStack(spacing: 0) {
                    header
                    MessageTimelineView(
                        messages: messages,
                        onOpenThread: onOpenThread,
                        onOpenAttachment: onOpenAttachment,
                        canManagePreparedActions: canManagePreparedActions,
                        onReviewPreparedCreateAgent: onReviewPreparedCreateAgent,
                        hasOlderMessages: hasOlderMessages,
                        isLoadingOlderMessages: isLoadingOlderMessages,
                        onLoadOlderMessages: onLoadOlderMessages,
                        onTapTimeline: { isComposerFocused = false },
                        scrollTargetMessageID: $scrollTargetMessageID
                    )
                    MessageComposerView(
                        text: $draft,
                        interaction: composerInteraction,
                        placeholder: "Message \(chat.kind.isChannel ? "#" : "")\(chat.title)",
                        isConnected: isConnected,
                        isTextFocused: $isComposerFocused,
                        transitionNamespace: composerTransitionNamespace,
                        onSend: onSend
                    )
                }
                .padding(.top, contentInsets.top)
                .padding(.bottom, contentInsets.bottom)

                ComposerAttachmentPortal(
                    interaction: composerInteraction,
                    availableSize: geometry.size,
                    transitionNamespace: composerTransitionNamespace
                )
                .zIndex(20)
            }
            .coordinateSpace(name: "composer-attachment-root")
        }
        .background(.background)
    }

    private var header: some View {
        ChromeHeader {
            GlassChromeButton(.sidebar, label: "Open navigation", action: onOpenSidebar)
        } center: {
            Button(action: onOpenChatDetails) {
                HStack(spacing: 7) {
                    chatIdentity
                    Text(chat.title).font(.headline).lineLimit(1)
                    Image(systemName: "chevron.right")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: 220)
            }
            .buttonStyle(.plain)
        } trailing: {
            GlassChromeButton(.symbol("magnifyingglass"), label: "Search messages", action: onOpenSearch)
        }
    }

    @ViewBuilder
    private var chatIdentity: some View {
        switch chat.kind {
        case .channel:
            ChannelIconBox(appearance: chat.appearance, size: 26)
        case .directMessage(let agent):
            AvatarView(name: agent.name, url: agent.avatarURL, presence: agent.presence, size: 30)
        }
    }

}

private extension ChatKind {
    var isChannel: Bool {
        if case .channel = self { true } else { false }
    }
}

#Preview {
    ChatScreenView(
        chat: ChatFixtures.chats[1],
        messages: ChatFixtures.messages,
        isConnected: true,
        onOpenSidebar: {},
        onOpenChatDetails: {},
        onOpenSearch: {},
        onOpenThread: { _ in },
        onSend: { _, _ in true }
    )
}
