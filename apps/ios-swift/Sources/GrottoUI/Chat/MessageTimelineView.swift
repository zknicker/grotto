import SwiftUI

public struct MessageTimelineView: View {
    private let messages: [MessagePresentation]
    private let onOpenThread: (MessagePresentation) -> Void
    private let onOpenAttachment: (MessageAttachmentPresentation) async throws -> URL
    private let hasOlderMessages: Bool
    private let isLoadingOlderMessages: Bool
    private let onLoadOlderMessages: (() async -> Bool)?
    private let onTapTimeline: () -> Void

    @Binding private var scrollTargetMessageID: String?
    @State private var preservedTopMessageID: String?
    @State private var highlightedMessageID: String?
    @State private var isNearBottom = true

    public init(
        messages: [MessagePresentation],
        onOpenThread: @escaping (MessagePresentation) -> Void,
        onOpenAttachment: @escaping (MessageAttachmentPresentation) async throws -> URL = { attachment in
            guard let localURL = attachment.localURL else { throw CancellationError() }
            return localURL
        },
        hasOlderMessages: Bool = false,
        isLoadingOlderMessages: Bool = false,
        onLoadOlderMessages: (() async -> Bool)? = nil,
        onTapTimeline: @escaping () -> Void = {},
        scrollTargetMessageID: Binding<String?> = .constant(nil)
    ) {
        _scrollTargetMessageID = scrollTargetMessageID
        self.messages = messages
        self.onOpenThread = onOpenThread
        self.onOpenAttachment = onOpenAttachment
        self.hasOlderMessages = hasOlderMessages
        self.isLoadingOlderMessages = isLoadingOlderMessages
        self.onLoadOlderMessages = onLoadOlderMessages
        self.onTapTimeline = onTapTimeline
    }

    /// The ScrollView is this view's root so a caller's `safeAreaInset` lands on the scroll
    /// content: the transcript then runs to the bottom of the screen and passes under the
    /// composer's glass, while the inset still reserves its scroll clearance.
    public var body: some View {
        ScrollViewReader { proxy in
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
            .scrollDismissesKeyboard(.interactively)
            .contentShape(.rect)
            .simultaneousGesture(TapGesture().onEnded { onTapTimeline() })
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
            .onChange(of: messages.last?.id) { previousMessageID, latestMessageID in
                guard let latestMessageID else { return }

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
                        proxy.scrollTo(latestMessageID, anchor: .bottom)
                    }
                case .animate:
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(latestMessageID, anchor: .bottom)
                    }
                }
            }
            .onChange(of: scrollTargetMessageID, initial: true) { _, _ in
                revealScrollTarget(using: proxy)
            }
            .onChange(of: messages.map(\.id)) { _, _ in
                // A search can select a Chat whose page is still loading, so
                // the pending request is re-resolved when messages arrive.
                revealScrollTarget(using: proxy)
            }
            .onChange(of: messages.first?.id) { _, _ in
                guard let preservedTopMessageID else { return }
                self.preservedTopMessageID = nil
                var transaction = Transaction()
                transaction.disablesAnimations = true
                withTransaction(transaction) {
                    proxy.scrollTo(preservedTopMessageID, anchor: .top)
                }
            }

            // The scroll clearance the composer reserves arrives as this view's bottom safe
            // area, so the button rides above the glass instead of under it.
            .overlay(alignment: .bottom) {
                if !isNearBottom {
                    GlassChromeButton(.icon(.arrowDown), label: "Scroll to latest message") {
                        guard let latestMessageID = messages.last?.id else { return }
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo(latestMessageID, anchor: .bottom)
                        }
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .padding(.bottom, 10)
                    .safeAreaPadding(.bottom)
                }
            }
        }
        .task(id: highlightedMessageID) {
            guard highlightedMessageID != nil else { return }
            try? await Task.sleep(for: .milliseconds(1_500))
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.45)) { highlightedMessageID = nil }
        }
    }

    private func revealScrollTarget(using proxy: ScrollViewProxy) {
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
                proxy.scrollTo(messageID, anchor: .center)
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
