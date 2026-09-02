import SwiftUI

public struct MessageTimelineView: View {
    private let messages: [MessagePresentation]
    private let isMessageHistoryLoaded: Bool
    private let emptyStateDescription: String
    private let onOpenThread: (MessagePresentation) -> Void
    private let onOpenAttachment: (MessageAttachmentPresentation) async throws -> URL
    private let canManagePreparedActions: Bool
    private let onReviewPreparedCreateAgent: (PreparedCreateAgentActionPresentation) -> Void
    private let onShowPreparedActionDetails: (PreparedCreateAgentActionPresentation) -> Void
    private let onOpenAgent: (String) -> Void
    private let hasOlderMessages: Bool
    private let isLoadingOlderMessages: Bool
    private let onLoadOlderMessages: (() async -> Bool)?

    @Binding private var scrollTargetMessageID: String?
    /// Attachment presentation is the screen's, not the row's: rows are hosted
    /// in table cells with no view controller of their own, and the image
    /// viewer's transition has to outlive the cell it grew out of.
    @State private var attachmentPreview: AttachmentPreview?
    @State private var attachmentTiles = AttachmentImageTileRegistry()
    @State private var highlightedMessageID: String?
    @State private var isNearNewest = true
    @State private var reveal: TranscriptReveal?
    /// The transcript's opening settle runs inside the table (see
    /// `TranscriptListView.animatesEntrance`), so the flag is read here rather
    /// than through the `openingEntrance` modifier.
    @Environment(\.opensWithEntrance) private var opensWithEntrance
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    public init(
        messages: [MessagePresentation],
        isMessageHistoryLoaded: Bool = true,
        emptyStateDescription: String = "Send a message to start the conversation.",
        onOpenThread: @escaping (MessagePresentation) -> Void,
        onOpenAttachment: @escaping (MessageAttachmentPresentation) async throws -> URL = { attachment in
            guard let localURL = attachment.localURL else { throw CancellationError() }
            return localURL
        },
        canManagePreparedActions: Bool = false,
        onReviewPreparedCreateAgent: @escaping (PreparedCreateAgentActionPresentation) -> Void = { _ in },
        onShowPreparedActionDetails: @escaping (PreparedCreateAgentActionPresentation) -> Void = { _ in },
        onOpenAgent: @escaping (String) -> Void = { _ in },
        hasOlderMessages: Bool = false,
        isLoadingOlderMessages: Bool = false,
        onLoadOlderMessages: (() async -> Bool)? = nil,
        scrollTargetMessageID: Binding<String?> = .constant(nil)
    ) {
        _scrollTargetMessageID = scrollTargetMessageID
        self.messages = messages
        self.isMessageHistoryLoaded = isMessageHistoryLoaded
        self.emptyStateDescription = emptyStateDescription
        self.onOpenThread = onOpenThread
        self.onOpenAttachment = onOpenAttachment
        self.canManagePreparedActions = canManagePreparedActions
        self.onReviewPreparedCreateAgent = onReviewPreparedCreateAgent
        self.onShowPreparedActionDetails = onShowPreparedActionDetails
        self.onOpenAgent = onOpenAgent
        self.hasOlderMessages = hasOlderMessages
        self.isLoadingOlderMessages = isLoadingOlderMessages
        self.onLoadOlderMessages = onLoadOlderMessages
    }

    /// The transcript sits on `TranscriptListView` — the flipped-table
    /// substrate — so the bottom anchor, keyboard rides, history prepends, and
    /// first-paint settling are all structural rather than managed here. This
    /// view owns only presentation: rows, the reveal request, the highlight,
    /// and the scroll-to-latest chevron. The caller's `safeAreaInset` and
    /// `chromeBar` land here as safe areas and are handed to the list as
    /// explicit clearances, so the transcript runs to the screen edges and
    /// passes under the header's and the composer's glass.
    public var body: some View {
        let indexByID = messageIndexByID
        return GeometryReader { proxy in
            if messages.isEmpty && isMessageHistoryLoaded {
                ContentUnavailableView(
                    "No messages yet",
                    systemImage: "bubble.left",
                    description: Text(emptyStateDescription)
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.top, proxy.safeAreaInsets.top)
                .padding(
                    .bottom,
                    dynamicTypeSize.isAccessibilitySize ? 0 : proxy.size.height * 0.175
                )
                .ignoresSafeArea()
            } else {
                TranscriptListView(
                    items: messages,
                    topInset: proxy.safeAreaInsets.top,
                    bottomInset: proxy.safeAreaInsets.bottom,
                    showsAccessory: hasOlderMessages && onLoadOlderMessages != nil,
                    onAppend: { items, isNearNewest in
                        switch MessageTimelineTailScroll.decide(
                            hadMessages: true,
                            isNearBottom: isNearNewest,
                            isLatestPending: items.last?.isPending == true
                        ) {
                        case .ignore: .stay
                        case .snap: .snapToNewest
                        case .animate: .animateToNewest
                        }
                    },
                    reveal: reveal,
                    isNearNewest: $isNearNewest,
                    animatesEntrance: opensWithEntrance,
                    menuActions: { message in
                        guard !message.isPending else { return [] }
                        return [
                            TranscriptMenuAction(
                                title: message.thread == nil ? "Reply in thread" : "Open thread",
                                systemImage: "bubble.left.and.bubble.right",
                                handler: { onOpenThread(message) }
                            )
                        ]
                    },
                    row: { message in
                        timelineRow(message, indexByID: indexByID)
                    },
                    accessory: {
                        loadOlderAccessory
                    }
                )
                .ignoresSafeArea()
                // The bottom edge stays hard on purpose: the composer's clearance
                // is the transcript's scroll bound, and its glass refracts the
                // rows that reach it.
                .transcriptTopDissolve(safeAreaTop: proxy.safeAreaInsets.top)
            }
        }
        // The scroll clearance the composer reserves arrives as this view's bottom safe
        // area, so the button rides above the glass instead of under it.
        .overlay(alignment: .bottom) {
            if !isNearNewest {
                GlassChromeButton(.icon(.arrowDown), label: "Scroll to latest message") {
                    reveal = messages.last.map {
                        TranscriptReveal(token: UUID(), id: $0.id, animated: true)
                    }
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .padding(.bottom, 10)
                .safeAreaPadding(.bottom)
            }
        }
        .animation(.easeOut(duration: 0.18), value: isNearNewest)
        .attachmentPreview(
            $attachmentPreview,
            images: AttachmentImagePages.pages(in: messages),
            tiles: attachmentTiles,
            onOpen: onOpenAttachment
        )
        .onChange(of: scrollTargetMessageID, initial: true) { _, _ in
            revealScrollTarget()
        }
        .onChange(of: messages.map(\.id)) { _, _ in
            // A search can select a Chat whose page is still loading, so
            // the pending request is re-resolved when messages arrive.
            revealScrollTarget()
        }
        .task(id: highlightedMessageID) {
            guard highlightedMessageID != nil else { return }
            try? await Task.sleep(for: .milliseconds(1_500))
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.45)) { highlightedMessageID = nil }
        }
    }

    private func revealScrollTarget() {
        guard let scrollTargetMessageID else { return }

        switch MessageTimelineScrollTarget.resolve(
            target: scrollTargetMessageID,
            messageIDs: messages.map(\.id)
        ) {
        case .waiting:
            return
        case .unavailable:
            // Paging older history to find an off-page message is out of scope.
            self.scrollTargetMessageID = nil
        case .reveal(let messageID):
            self.scrollTargetMessageID = nil
            reveal = TranscriptReveal(token: UUID(), id: messageID, animated: true)
            highlightedMessageID = messageID
        }
    }

    @ViewBuilder
    private var loadOlderAccessory: some View {
        if let onLoadOlderMessages {
            Button {
                Task { @MainActor in _ = await onLoadOlderMessages() }
            } label: {
                Group {
                    if isLoadingOlderMessages {
                        ProgressView()
                    } else {
                        Label("Load older messages", systemImage: "chevron.up")
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(isLoadingOlderMessages)
            .padding(.bottom, 8)
        }
    }

    /// Row lookups run once per hosted row on every update, so the index is a
    /// dictionary rather than a scan of the page.
    private var messageIndexByID: [String: Int] {
        Dictionary(
            uniqueKeysWithValues: messages.enumerated().map { ($0.element.id, $0.offset) }
        )
    }

    @ViewBuilder
    private func timelineRow(_ message: MessagePresentation, indexByID: [String: Int]) -> some View {
        let index = indexByID[message.id] ?? 0
        let continuation = isContinuation(at: index)
        messageRow(message, isContinuation: continuation)
            .padding(.top, index == 0 ? 0 : continuation ? 4 : 16)
    }

    private func messageRow(
        _ message: MessagePresentation,
        isContinuation: Bool
    ) -> some View {
        HStack(alignment: .top, spacing: 11) {
            if isContinuation {
                Color.clear.frame(width: 38, height: 1)
            } else {
                AvatarView(
                    name: message.author.name,
                    url: message.author.avatarURL,
                    presence: message.author.presence,
                    size: 38
                )
            }

            VStack(alignment: .leading, spacing: 3) {
                if !isContinuation {
                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        Text(message.author.name)
                            .font(.body.weight(.semibold))
                            .lineLimit(1)
                        Text(message.createdAt, format: .dateTime.hour().minute())
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                let content = message.content.trimmingCharacters(in: .whitespacesAndNewlines)
                if !content.isEmpty {
                    RichMessageContentView(segments: message.richSegments)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if !message.attachments.isEmpty {
                    MessageAttachmentGroup(
                        attachments: message.attachments,
                        isPending: message.isPending,
                        preview: $attachmentPreview,
                        tiles: attachmentTiles,
                        onOpen: onOpenAttachment
                    )
                    .padding(.top, content.isEmpty ? 0 : 3)
                }

                if let preparedAction = message.preparedAction {
                    PreparedActionCardView(
                        action: preparedAction,
                        canManage: canManagePreparedActions,
                        onReviewCreateAgent: onReviewPreparedCreateAgent,
                        onShowDetails: onShowPreparedActionDetails,
                        onOpenAgent: onOpenAgent
                    )
                    // The card's collapse and its memory of having been live
                    // are per-action state, and transcript rows are hosted in
                    // recycled cells reconfigured in place. Keying on the
                    // action retires that state with the action it belongs to,
                    // so a collapsed card cannot blank the next message's live
                    // one.
                    .id(preparedAction.id)
                    .padding(.top, content.isEmpty ? 0 : 6)
                }

                if message.isPending {
                    HStack(spacing: 5) {
                        ProgressView().controlSize(.mini)
                        Text("Sending").font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(.top, 2)
                }

                if message.thread?.replyCount ?? 0 > 0 || message.task != nil {
                    ThreadPreviewCard(
                        thread: message.thread,
                        task: message.task,
                        onOpen: { onOpenThread(message) }
                    )
                }
            }
        }
        // The tint is drawn behind the row without changing its layout, so a
        // revealed message keeps the timeline's ordinary rhythm.
        .background {
            RoundedRectangle(cornerRadius: 12)
                .fill(GrottoPlatformColor.inputSurface)
                .opacity(highlightedMessageID == message.id ? 1 : 0)
                .padding(.horizontal, -8)
                .padding(.vertical, -5)
        }
    }

    private func isContinuation(at index: Int) -> Bool {
        guard index > 0 else { return false }
        let message = messages[index]
        let previous = messages[index - 1]
        return message.author.id == previous.author.id
            && message.createdAt.timeIntervalSince(previous.createdAt) < 5 * 60
    }

}

#Preview {
    MessageTimelineView(messages: ChatFixtures.messages, onOpenThread: { _ in })
}

#Preview("Empty") {
    MessageTimelineView(
        messages: [],
        emptyStateDescription: "Start the conversation in #product.",
        onOpenThread: { _ in }
    )
}
