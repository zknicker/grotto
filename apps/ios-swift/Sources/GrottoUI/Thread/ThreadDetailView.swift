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
    /// The bottom is held as a scroll *edge* for the reason the Chat transcript holds
    /// it that way: an offset onto the last row resolves against a container height the
    /// first paint may not have yet. See `MessageTimelineView`.
    @State private var scrollPosition = ScrollPosition(edge: .bottom)
    @State private var preservedTopReplyID: String?
    @State private var isNearBottom = true
    /// Whether the replies are at rest, for the same reason the Chat transcript
    /// tracks it: a drag and its fling travel past the end on purpose.
    @State private var isScrollIdle = true
    /// Whether the latest geometry left the viewport past the last reply, held
    /// as state so the rescue waits out a layout still in motion.
    @State private var isPastRepliesEnd = false
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

        GeometryReader { geometry in
            ZStack(alignment: .bottomLeading) {
                VStack(spacing: 0) {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            if hasOlderReplies, let onLoadOlderReplies {
                                Button {
                                    preservedTopReplyID = replies.first?.id
                                    Task { @MainActor in
                                        if !(await onLoadOlderReplies()) {
                                            preservedTopReplyID = nil
                                        }
                                    }
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

                            ThreadMessageRow(
                                message: anchor,
                                emphasized: true,
                                onOpenAttachment: onOpenAttachment,
                                canManagePreparedActions: canManagePreparedActions,
                                onReviewPreparedCreateAgent: onReviewPreparedCreateAgent
                            )
                                .padding(.bottom, replies.isEmpty ? 0 : 2)

                            if let task = anchor.task {
                                ThreadTaskMetadataView(task: task)
                                    .padding(.top, 12)
                                    .padding(.bottom, replies.isEmpty ? 0 : 2)
                            }

                            ForEach(replies) { message in
                                ThreadMessageRow(
                                    message: message,
                                    onOpenAttachment: onOpenAttachment,
                                    canManagePreparedActions: canManagePreparedActions,
                                    onReviewPreparedCreateAgent: onReviewPreparedCreateAgent
                                )
                                    .id(message.id)
                                    .padding(.top, 10)
                            }

                            if pending {
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
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .contentShape(.rect)
                    .simultaneousGesture(TapGesture().onEnded { isComposerFocused = false })
                    .scrollPosition($scrollPosition)
                    // A thread shorter than the screen still sits on the composer.
                    .defaultScrollAnchor(.bottom)
                    .onScrollGeometryChange(for: Bool.self) { geometry in
                        ThreadReplyScrollPosition.isNearBottom(
                            contentHeight: geometry.contentSize.height,
                            containerHeight: geometry.containerSize.height,
                            visibleMaxY: geometry.visibleRect.maxY
                        )
                    } action: { _, nearBottom in
                        isNearBottom = nearBottom
                    }
                    .onScrollPhaseChange { _, phase in isScrollIdle = phase == .idle }
                    // A first layout can resolve the bottom against a content
                    // height the lazy rows have not settled into and leave the
                    // viewport past the last reply. Only a layout can reach that
                    // state — a gesture is clamped to the content — and nothing
                    // else here would leave it, so a resting viewport is put
                    // back on the bottom.
                    .onScrollGeometryChange(for: Bool.self) { geometry in
                        ThreadReplyScrollPosition.isPastContentEnd(
                            contentHeight: geometry.contentSize.height,
                            containerHeight: geometry.containerSize.height,
                            bottomInset: geometry.contentInsets.bottom,
                            visibleMaxY: geometry.visibleRect.maxY
                        )
                    } action: { _, isPastContentEnd in
                        isPastRepliesEnd = isPastContentEnd
                    }
                    // Deferred for the same reason as the Chat timeline's
                    // rescue: an edge asserted mid-layout resolves against
                    // moving numbers and strobes. A real strand holds at rest,
                    // and idleness in the key re-arms one reported mid-touch.
                    .task(id: isPastRepliesEnd && isScrollIdle) {
                        guard isPastRepliesEnd, isScrollIdle else { return }
                        try? await Task.sleep(for: .milliseconds(120))
                        guard !Task.isCancelled, isPastRepliesEnd, isScrollIdle else { return }
                        var transaction = Transaction()
                        transaction.disablesAnimations = true
                        withTransaction(transaction) {
                            scrollPosition.scrollTo(edge: .bottom)
                        }
                    }
                    .onChange(of: replies.last?.id) { previousLatestID, latestReplyID in
                        guard latestReplyID != nil else { return }

                        switch ThreadReplyReveal.onLatestReplyChange(
                            previousLatestID: previousLatestID,
                            isNearBottom: isNearBottom,
                            latestIsPending: replies.last?.isPending == true
                        ) {
                        case .settle:
                            var transaction = Transaction()
                            transaction.disablesAnimations = true
                            withTransaction(transaction) {
                                scrollPosition.scrollTo(edge: .bottom)
                            }
                        case .animate:
                            withAnimation(.easeOut(duration: 0.2)) {
                                scrollPosition.scrollTo(edge: .bottom)
                            }
                        case .stay:
                            break
                        }
                    }
                    .onChange(of: replies.count) { _, _ in
                        guard let preservedTopReplyID else { return }
                        self.preservedTopReplyID = nil
                        var transaction = Transaction()
                        transaction.disablesAnimations = true
                        withTransaction(transaction) {
                            scrollPosition.scrollTo(id: preservedTopReplyID, anchor: .top)
                        }
                    }
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
        .navigationTitle("Thread")
        .grottoInlineNavigationTitle()
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

/// Mirror of the chat timeline's near-bottom rule, owned by the Thread surface.
enum ThreadReplyScrollPosition {
    private static let bottomTolerance: CGFloat = 80
    private static let overshootTolerance: CGFloat = 1

    static func isNearBottom(
        contentHeight: CGFloat,
        containerHeight: CGFloat,
        visibleMaxY: CGFloat
    ) -> Bool {
        if contentHeight <= containerHeight + 1 {
            return true
        }
        return visibleMaxY >= contentHeight - bottomTolerance
    }

    /// Mirror of `MessageTimelineScrollPosition.isPastContentEnd`, for the same
    /// reason: a Thread opened onto replies that are already loaded never
    /// appends one, so nothing else would move a viewport that a first layout
    /// left past the end of them. Replies shorter than the container have no
    /// end to be past — the bottom anchor pads their top by design.
    static func isPastContentEnd(
        contentHeight: CGFloat,
        containerHeight: CGFloat,
        bottomInset: CGFloat,
        visibleMaxY: CGFloat
    ) -> Bool {
        guard contentHeight > containerHeight else { return false }
        return visibleMaxY > contentHeight + bottomInset + overshootTolerance
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
