import SwiftUI

public struct MessageTimelineView: View {
    private let messages: [MessagePresentation]
    private let onOpenThread: (MessagePresentation) -> Void
    private let onOpenAttachment: (MessageAttachmentPresentation) async throws -> URL
    private let canManagePreparedActions: Bool
    private let onReviewPreparedCreateAgent: (PreparedCreateAgentActionPresentation) -> Void
    private let hasOlderMessages: Bool
    private let isLoadingOlderMessages: Bool
    private let onLoadOlderMessages: (() async -> Bool)?

    @Binding private var scrollTargetMessageID: String?
    /// The bottom is held as a scroll *edge*, not as an offset onto the last row. An
    /// offset has to resolve against a container height, and a Chat's first paint
    /// resolves before the canvas has one, which parked the transcript a full screen
    /// past its own content. An edge follows the bottom while the page lands and the
    /// rows settle, and stops following the moment the reader scrolls away from it.
    /// The scroll view is still what resolves that edge, though, so the guard below
    /// covers the first layout, where it can resolve against numbers still moving.
    @State private var scrollPosition = ScrollPosition(edge: .bottom)
    @State private var preservedTopMessageID: String?
    @State private var highlightedMessageID: String?
    @State private var isNearBottom = true
    /// Whether the transcript is at rest. Only a resting viewport is put back
    /// on the bottom: a drag and the fling after it travel past the end on
    /// purpose, and the scroll view already brings those back itself.
    @State private var isScrollIdle = true
    /// Whether the latest scroll geometry left the viewport past the end of the
    /// transcript. Held as state so the rescue below can wait out a layout
    /// still in motion and re-check before it moves anything.
    @State private var isPastContentEnd = false

    public init(
        messages: [MessagePresentation],
        onOpenThread: @escaping (MessagePresentation) -> Void,
        onOpenAttachment: @escaping (MessageAttachmentPresentation) async throws -> URL = { attachment in
            guard let localURL = attachment.localURL else { throw CancellationError() }
            return localURL
        },
        canManagePreparedActions: Bool = false,
        onReviewPreparedCreateAgent: @escaping (PreparedCreateAgentActionPresentation) -> Void = { _ in },
        hasOlderMessages: Bool = false,
        isLoadingOlderMessages: Bool = false,
        onLoadOlderMessages: (() async -> Bool)? = nil,
        scrollTargetMessageID: Binding<String?> = .constant(nil)
    ) {
        _scrollTargetMessageID = scrollTargetMessageID
        self.messages = messages
        self.onOpenThread = onOpenThread
        self.onOpenAttachment = onOpenAttachment
        self.canManagePreparedActions = canManagePreparedActions
        self.onReviewPreparedCreateAgent = onReviewPreparedCreateAgent
        self.hasOlderMessages = hasOlderMessages
        self.isLoadingOlderMessages = isLoadingOlderMessages
        self.onLoadOlderMessages = onLoadOlderMessages
    }

    /// The ScrollView is this view's root so a caller's `safeAreaInset` lands on the scroll
    /// content: the transcript then runs to the bottom of the screen and passes under the
    /// composer's glass, while the inset still reserves its scroll clearance.
    public var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if hasOlderMessages, let onLoadOlderMessages {
                    Button {
                        preservedTopMessageID = messages.first?.id
                        Task { @MainActor in
                            if !(await onLoadOlderMessages()) {
                                preservedTopMessageID = nil
                            }
                        }
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

                ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                    let continuation = isContinuation(at: index)
                    messageRow(message, isContinuation: continuation)
                        .id(message.id)
                        .padding(.top, index == 0 ? 0 : continuation ? 4 : 16)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        // Dragging the transcript downward is the one gesture that puts the
        // keyboard (and with it the expanded composer) away, matching the
        // platform's interactive dismissal. Taps on the transcript stay inert.
        .scrollDismissesKeyboard(.interactively)
        .scrollPosition($scrollPosition)
        // A transcript shorter than the screen still sits on the composer.
        .defaultScrollAnchor(.bottom)
        .onScrollGeometryChange(for: Bool.self) { geometry in
            MessageTimelineScrollPosition.isNearBottom(
                contentHeight: geometry.contentSize.height,
                containerHeight: geometry.containerSize.height,
                visibleMaxY: geometry.visibleRect.maxY
            )
        } action: { _, nearBottom in
            withAnimation(.easeOut(duration: 0.18)) {
                isNearBottom = nearBottom
            }
        }
        .onScrollPhaseChange { _, phase in isScrollIdle = phase == .idle }
        // The edge the transcript holds is resolved by the scroll view, and a
        // Chat's first layout can resolve it against a content height its lazy
        // rows have not settled into. When they settle shorter, the viewport is
        // left past the end of the transcript — a state no reader can reach and
        // none can be left in, so it is put back on the bottom here. Without
        // this, a Chat whose page was already loaded had nothing that would
        // ever move it: its last message never changes, so the tail scroll
        // below never runs, and the transcript stayed blank until dragged.
        .onScrollGeometryChange(for: Bool.self) { geometry in
            MessageTimelineScrollPosition.isPastContentEnd(
                contentHeight: geometry.contentSize.height,
                containerHeight: geometry.containerSize.height,
                bottomInset: geometry.contentInsets.bottom,
                visibleMaxY: geometry.visibleRect.maxY
            )
        } action: { _, isPastContentEnd in
            self.isPastContentEnd = isPastContentEnd
        }
        // The rescue must not answer the geometry change that reported the
        // strand: an app open lays the canvas out over several frames, and a
        // bottom edge asserted mid-flight resolves against numbers still
        // moving, strands again, and reports again — the transcript strobed
        // blank at frame rate. A strand is only real once it survives a beat
        // at rest; the one that matters (a cached Chat that nothing else will
        // ever move) holds indefinitely, so waiting costs it nothing. Idleness
        // is part of the key so a strand reported mid-touch re-arms the rescue
        // when the scroll comes back to rest instead of being dropped.
        .task(id: isPastContentEnd && isScrollIdle) {
            guard isPastContentEnd, isScrollIdle else { return }
            try? await Task.sleep(for: .milliseconds(120))
            guard !Task.isCancelled, isPastContentEnd, isScrollIdle else { return }
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
                scrollPosition.scrollTo(edge: .bottom)
            }
        }
        .onChange(of: messages.last?.id) { previousMessageID, latestMessageID in
            guard latestMessageID != nil else { return }

            switch MessageTimelineTailScroll.decide(
                hadMessages: previousMessageID != nil,
                isNearBottom: isNearBottom,
                isLatestPending: messages.last?.isPending == true
            ) {
            case .ignore:
                return
            case .snap:
                var transaction = Transaction()
                transaction.disablesAnimations = true
                withTransaction(transaction) {
                    scrollPosition.scrollTo(edge: .bottom)
                }
            case .animate:
                withAnimation(.easeOut(duration: 0.2)) {
                    scrollPosition.scrollTo(edge: .bottom)
                }
            }
        }
        .onChange(of: scrollTargetMessageID, initial: true) { _, _ in
            revealScrollTarget()
        }
        .onChange(of: messages.map(\.id)) { _, _ in
            // A search can select a Chat whose page is still loading, so
            // the pending request is re-resolved when messages arrive.
            revealScrollTarget()
        }
        .onChange(of: messages.first?.id) { _, _ in
            guard let preservedTopMessageID else { return }
            self.preservedTopMessageID = nil
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
                scrollPosition.scrollTo(id: preservedTopMessageID, anchor: .top)
            }
        }
        // The scroll clearance the composer reserves arrives as this view's bottom safe
        // area, so the button rides above the glass instead of under it.
        .overlay(alignment: .bottom) {
            if !isNearBottom {
                GlassChromeButton(.icon(.arrowDown), label: "Scroll to latest message") {
                    withAnimation(.easeOut(duration: 0.2)) {
                        scrollPosition.scrollTo(edge: .bottom)
                    }
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .padding(.bottom, 10)
                .safeAreaPadding(.bottom)
            }
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
            withAnimation(.easeInOut(duration: 0.25)) {
                scrollPosition.scrollTo(id: messageID, anchor: .center)
            }
            highlightedMessageID = messageID
        }
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
                        onOpen: onOpenAttachment
                    )
                    .padding(.top, content.isEmpty ? 0 : 3)
                }

                if let preparedAction = message.preparedAction {
                    PreparedActionCardView(
                        action: preparedAction,
                        canManage: canManagePreparedActions,
                        onReviewCreateAgent: onReviewPreparedCreateAgent
                    )
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
        .contextMenu {
            if !message.isPending {
                Button {
                    onOpenThread(message)
                } label: {
                    Label(
                        message.thread == nil ? "Reply in thread" : "Open thread",
                        systemImage: "bubble.left.and.bubble.right"
                    )
                }
            }
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
