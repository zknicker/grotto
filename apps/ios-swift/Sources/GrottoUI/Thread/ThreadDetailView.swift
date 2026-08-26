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

    @State private var draft = ""
    @State private var preservedTopReplyID: String?
    @State private var isNearBottom = true
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
        onLoadOlderReplies: (() async -> Bool)? = nil
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
        onLoadOlderReplies: (() async -> Bool)? = nil
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
    }

    public var body: some View {
        let replies = replyProvider()

        GeometryReader { geometry in
            ZStack(alignment: .bottomLeading) {
                VStack(spacing: 0) {
                    ScrollViewReader { proxy in
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
                            onOpenAttachment: onOpenAttachment
                        )
                            .padding(.bottom, replies.isEmpty ? 0 : 2)

                        if let task = anchor.task {
                            ThreadTaskMetadataView(task: task)
                                .padding(.top, 12)
                                .padding(.bottom, replies.isEmpty ? 0 : 2)
                        }

                        ForEach(replies) { message in
                            ThreadMessageRow(message: message, onOpenAttachment: onOpenAttachment)
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
                        .onChange(of: replies.last?.id) { previousLatestID, latestReplyID in
                            guard let latestReplyID else { return }

                            switch ThreadReplyReveal.onLatestReplyChange(
                                previousLatestID: previousLatestID,
                                isNearBottom: isNearBottom,
                                latestIsPending: replies.last?.isPending == true
                            ) {
                            case .settle:
                                var transaction = Transaction()
                                transaction.disablesAnimations = true
                                withTransaction(transaction) {
                                    proxy.scrollTo(latestReplyID, anchor: .bottom)
                                }
                            case .animate:
                                withAnimation(.easeOut(duration: 0.2)) {
                                    proxy.scrollTo(latestReplyID, anchor: .bottom)
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
                                proxy.scrollTo(preservedTopReplyID, anchor: .top)
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

                ComposerAttachmentPortal(
                    interaction: composerInteraction,
                    availableSize: geometry.size,
                    transitionNamespace: composerTransitionNamespace
                )
                .ignoresSafeArea(.keyboard)
                .zIndex(20)
            }
            .coordinateSpace(name: "composer-attachment-root")
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
