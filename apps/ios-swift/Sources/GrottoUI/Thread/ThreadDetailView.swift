import SwiftUI

/// A native NavigationStack destination for one message thread.
///
/// The parent chat owns fetching and mutation. This view only presents the
/// anchor, task metadata, current reply state, and local pending state.
public struct ThreadDetailView: View {
    private let anchor: MessagePresentation
    private let replyProvider: () -> [MessagePresentation]
    private let pending: Bool
    private let isConnected: Bool
    private let onSend: (String, [ComposerAttachment]) async -> Bool
    private let onOpenAttachment: (MessageAttachmentPresentation) async throws -> URL
    private let allowsAttachments: Bool
    private let hasOlderReplies: Bool
    private let isLoadingOlderReplies: Bool
    private let onLoadOlderReplies: (() async -> Bool)?
    private let canManagePreparedActions: Bool
    private let onReviewPreparedCreateAgent: (PreparedCreateAgentActionPresentation) -> Void

    @State private var draft = ""
    @State private var isNearNewest = true
    /// Same ownership rule as the Chat timeline: the screen presents, the rows
    /// only ask.
    @State private var attachmentPreview: AttachmentPreview?
    @State private var attachmentTiles = AttachmentImageTileRegistry()
    /// A Thread is one pushed screen rather than a keyed canvas, so its composer
    /// state is screen-owned: it survives anything presented over the Thread and
    /// goes away with the pop, unlike the Chat canvas, whose interactions the
    /// shell keeps per destination.
    @State private var composerInteraction = ComposerInteraction()
    @FocusState private var isComposerFocused: Bool
    @Namespace private var composerTransitionNamespace

    public init(
        anchor: MessagePresentation,
        replies: [MessagePresentation],
        pending: Bool = false,
        isConnected: Bool = true,
        allowsAttachments: Bool = true,
        onSend: @escaping (String, [ComposerAttachment]) async -> Bool,
        onOpenAttachment: @escaping (MessageAttachmentPresentation) async throws -> URL = { attachment in
            guard let localURL = attachment.localURL else { throw CancellationError() }
            return localURL
        },
        hasOlderReplies: Bool = false,
        isLoadingOlderReplies: Bool = false,
        onLoadOlderReplies: (() async -> Bool)? = nil,
        canManagePreparedActions: Bool = false,
        onReviewPreparedCreateAgent: @escaping (PreparedCreateAgentActionPresentation) -> Void = { _ in }
    ) {
        self.anchor = anchor
        self.replyProvider = { replies }
        self.pending = pending
        self.isConnected = isConnected
        self.onSend = onSend
        self.onOpenAttachment = onOpenAttachment
        self.allowsAttachments = allowsAttachments
        self.hasOlderReplies = hasOlderReplies
        self.isLoadingOlderReplies = isLoadingOlderReplies
        self.onLoadOlderReplies = onLoadOlderReplies
        self.canManagePreparedActions = canManagePreparedActions
        self.onReviewPreparedCreateAgent = onReviewPreparedCreateAgent
    }

    /// Resolves replies while this view's body is being evaluated so an
    /// observation-backed store can invalidate the thread after its first
    /// network load.
    public init(
        anchor: MessagePresentation,
        replies: @escaping () -> [MessagePresentation],
        pending: Bool = false,
        isConnected: Bool = true,
        allowsAttachments: Bool = true,
        onSend: @escaping (String, [ComposerAttachment]) async -> Bool,
        onOpenAttachment: @escaping (MessageAttachmentPresentation) async throws -> URL = { attachment in
            guard let localURL = attachment.localURL else { throw CancellationError() }
            return localURL
        },
        hasOlderReplies: Bool = false,
        isLoadingOlderReplies: Bool = false,
        onLoadOlderReplies: (() async -> Bool)? = nil,
        canManagePreparedActions: Bool = false,
        onReviewPreparedCreateAgent: @escaping (PreparedCreateAgentActionPresentation) -> Void = { _ in }
    ) {
        self.anchor = anchor
        self.replyProvider = replies
        self.pending = pending
        self.isConnected = isConnected
        self.onSend = onSend
        self.onOpenAttachment = onOpenAttachment
        self.allowsAttachments = allowsAttachments
        self.hasOlderReplies = hasOlderReplies
        self.isLoadingOlderReplies = isLoadingOlderReplies
        self.onLoadOlderReplies = onLoadOlderReplies
        self.canManagePreparedActions = canManagePreparedActions
        self.onReviewPreparedCreateAgent = onReviewPreparedCreateAgent
    }

    public var body: some View {
        let replies = replyProvider()
        let items = transcriptItems(replies: replies)

        GeometryReader { geometry in
            ZStack(alignment: .bottomLeading) {
                transcript(items: items)
                    // Same shape as the chat screen: replies run under the floating glass
                    // composer and the inset reserves their clearance.
                    .safeAreaInset(edge: .bottom, spacing: 0) {
                        MessageComposerView(
                            text: $draft,
                            interaction: composerInteraction,
                            placeholder: "Reply in thread",
                            isConnected: isConnected,
                            isTextFocused: $isComposerFocused,
                            allowsAttachments: allowsAttachments,
                            transitionNamespace: composerTransitionNamespace,
                            onSend: { content, attachments in
                                guard !pending else { return false }
                                return await onSend(content, attachments)
                            }
                        )
                    }
            }
            // Same contract as the Chat screen: the portal draws in an overlay window above the
            // keyboard, measured against the display rather than against this screen.
            .composerAttachmentPortal(
                interaction: composerInteraction,
                transitionNamespace: composerTransitionNamespace
            )
            .composerPortalFreeze(
                interaction: composerInteraction,
                isTextFocused: $isComposerFocused,
                liveBottomInset: geometry.safeAreaInsets.bottom
            )
        }
        .background(.background)
        .attachmentPreview(
            $attachmentPreview,
            images: AttachmentImagePages.pages(in: [anchor] + replies),
            tiles: attachmentTiles,
            onOpen: onOpenAttachment
        )
        .navigationTitle("Thread")
        .grottoInlineNavigationTitle()
    }

    /// The replies sit on the same flipped-table substrate as the Chat
    /// timeline, so the bottom anchor, keyboard rides, and history prepends
    /// are structural here too. The anchor and its task metadata are simply
    /// the transcript's oldest items.
    private func transcript(items: [ThreadTranscriptItem]) -> some View {
        GeometryReader { proxy in
            TranscriptListView(
                items: items,
                topInset: proxy.safeAreaInsets.top,
                bottomInset: proxy.safeAreaInsets.bottom,
                showsAccessory: hasOlderReplies && onLoadOlderReplies != nil,
                onAppend: { items, isNearNewest in
                    // A first page reaches the substrate as a reset that lands
                    // already settled, so an append always has a predecessor;
                    // the sentinel only says "not the first page".
                    switch ThreadReplyReveal.onLatestReplyChange(
                        previousLatestID: items.first?.id,
                        isNearBottom: isNearNewest,
                        latestIsPending: items.last?.isPending == true
                    ) {
                    case .settle: .snapToNewest
                    case .animate: .animateToNewest
                    case .stay: .stay
                    }
                },
                reveal: nil,
                isNearNewest: $isNearNewest,
                onContentTap: { isComposerFocused = false },
                row: { item in
                    threadRow(item)
                },
                accessory: {
                    loadOlderAccessory
                }
            )
            .ignoresSafeArea()
            // Same soft top edge as the Chat timeline, under the navigation
            // bar instead of the chat header.
            .transcriptTopDissolve(safeAreaTop: proxy.safeAreaInsets.top)
        }
    }

    private func transcriptItems(replies: [MessagePresentation]) -> [ThreadTranscriptItem] {
        var items: [ThreadTranscriptItem] = [.anchor(anchor, hasReplies: !replies.isEmpty)]
        if let task = anchor.task {
            items.append(.taskMetadata(task, hasReplies: !replies.isEmpty))
        }
        items.append(contentsOf: replies.map(ThreadTranscriptItem.reply))
        if pending {
            items.append(.pendingSend)
        }
        return items
    }

    @ViewBuilder
    private func threadRow(_ item: ThreadTranscriptItem) -> some View {
        switch item {
        case .anchor(let message, let hasReplies):
            ThreadMessageRow(
                message: message,
                emphasized: true,
                onOpenAttachment: onOpenAttachment,
                preview: $attachmentPreview,
                tiles: attachmentTiles,
                canManagePreparedActions: canManagePreparedActions,
                onReviewPreparedCreateAgent: onReviewPreparedCreateAgent
            )
            .padding(.bottom, hasReplies ? 2 : 0)
        case .taskMetadata(let task, let hasReplies):
            ThreadTaskMetadataView(task: task)
                .padding(.top, 12)
                .padding(.bottom, hasReplies ? 2 : 0)
        case .reply(let message):
            ThreadMessageRow(
                message: message,
                onOpenAttachment: onOpenAttachment,
                preview: $attachmentPreview,
                tiles: attachmentTiles,
                canManagePreparedActions: canManagePreparedActions,
                onReviewPreparedCreateAgent: onReviewPreparedCreateAgent
            )
            .padding(.top, 10)
        case .pendingSend:
            HStack(spacing: 7) {
                ProgressView()
                    .controlSize(.small)
                Text("Sending")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.leading, 46)
            .padding(.top, 12)
        }
    }

    @ViewBuilder
    private var loadOlderAccessory: some View {
        if let onLoadOlderReplies {
            Button {
                Task { @MainActor in _ = await onLoadOlderReplies() }
            } label: {
                Group {
                    if isLoadingOlderReplies {
                        ProgressView()
                    } else {
                        Label("Load older replies", systemImage: "chevron.up")
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(isLoadingOlderReplies)
            .padding(.bottom, 8)
        }
    }

}

/// One row of the Thread transcript. A Thread's page is more than replies —
/// the anchor message, its task metadata, and a pending send all occupy
/// chronological positions — so the substrate sees them as items with stable
/// ids rather than as decoration around a reply list.
private enum ThreadTranscriptItem: Identifiable, Equatable {
    case anchor(MessagePresentation, hasReplies: Bool)
    case taskMetadata(TaskPresentation, hasReplies: Bool)
    case reply(MessagePresentation)
    case pendingSend

    var id: String {
        switch self {
        case .anchor(let message, _): "thread-anchor-\(message.id)"
        case .taskMetadata: "thread-task-metadata"
        case .reply(let message): message.id
        case .pendingSend: "thread-pending-send"
        }
    }

    var isPending: Bool {
        switch self {
        case .pendingSend: true
        case .reply(let message): message.isPending
        case .anchor, .taskMetadata: false
        }
    }
}

/// Decides how the thread transcript responds when its latest reply changes.
///
/// Local to the Thread surface on purpose: the chat timeline owns its own
/// parallel rule, and the two surfaces may diverge.
enum ThreadReplyReveal: Equatable {
    /// The first page just arrived; place it at the bottom with no animation
    /// so the thread appears already settled.
    case settle
    /// Reveal the latest reply with a short animated scroll.
    case animate
    /// Leave the reader where they are.
    case stay

    static func onLatestReplyChange(
        previousLatestID: String?,
        isNearBottom: Bool,
        latestIsPending: Bool
    ) -> ThreadReplyReveal {
        if previousLatestID == nil {
            return .settle
        }
        // Pending rows exist only for the viewer's outgoing sends, so a send
        // always reveals itself; other appends respect the reader's position.
        if latestIsPending || isNearBottom {
            return .animate
        }
        return .stay
    }
}

#Preview("Thread") {
    NavigationStack {
        ThreadDetailView(
            anchor: ChatFixtures.messages[1],
            replies: [
                MessagePresentation(
                    id: "thread-reply-1",
                    author: ChatFixtures.messages[0].author,
                    content: "I’ll keep the first pass focused on the native shell.",
                    createdAt: .now.addingTimeInterval(-90)
                ),
                MessagePresentation(
                    id: "thread-reply-2",
                    author: ChatFixtures.messages[1].author,
                    content: "Perfect. I’ll preserve the shared Server contract.",
                    createdAt: .now.addingTimeInterval(-45)
                ),
            ],
            onSend: { _, _ in true }
        )
    }
}

#Preview("Task Thread") {
    NavigationStack {
        ThreadDetailView(
            anchor: ChatFixtures.messages[2],
            replies: [
                MessagePresentation(
                    id: "task-thread-reply-1",
                    author: ChatFixtures.messages[1].author,
                    content: "I’ll keep the work visible in this Thread.",
                    createdAt: .now.addingTimeInterval(-45)
                ),
            ],
            onSend: { _, _ in true }
        )
    }
}
