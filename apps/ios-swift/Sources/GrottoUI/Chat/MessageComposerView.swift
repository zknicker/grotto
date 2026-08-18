import SwiftUI
import UniformTypeIdentifiers
#if os(iOS)
import UIKit
#endif

public struct MessageComposerView: View {
    @Binding private var text: String
    @Bindable private var interaction: ComposerInteraction
    private let placeholder: String
    private let isConnected: Bool
    private let allowsAttachments: Bool
    private let transitionNamespace: Namespace.ID?
    private let onSend: (String, [ComposerAttachment]) async -> Bool

    @FocusState.Binding private var isTextFocused: Bool
    @AccessibilityFocusState private var isAttachmentButtonFocused: Bool
    @State private var attachmentReadyFeedback = 0

    public init(
        text: Binding<String>,
        interaction: ComposerInteraction,
        placeholder: String,
        isConnected: Bool,
        isTextFocused: FocusState<Bool>.Binding,
        allowsAttachments: Bool = true,
        transitionNamespace: Namespace.ID? = nil,
        onSend: @escaping (String, [ComposerAttachment]) async -> Bool
    ) {
        _text = text
        self.interaction = interaction
        self.placeholder = placeholder
        self.isConnected = isConnected
        _isTextFocused = isTextFocused
        self.allowsAttachments = allowsAttachments
        self.transitionNamespace = transitionNamespace
        self.onSend = onSend
    }

    public var body: some View {
        Group {
            if #available(iOS 26, macOS 26, *) {
                GlassEffectContainer(spacing: 8) {
                    composerStack
                }
            } else {
                composerStack
            }
        }
        .padding(.horizontal, isExpanded ? 12 : 30)
        .padding(.top, 4)
        .padding(.bottom, 0)
        .background(.background)
        .animation(.spring(response: 0.3, dampingFraction: 0.9), value: isExpanded)
        .animation(.smooth(duration: 0.28), value: interaction.attachments.count)
        .animation(.smooth(duration: 0.22), value: isConnected)
        .sensoryFeedback(.success, trigger: attachmentReadyFeedback)
        .onChange(of: interaction.overlay) { _, overlay in
            Task { @MainActor in
                await Task.yield()
                switch overlay {
                case .photos, .camera:
                    isTextFocused = false
                    isAttachmentButtonFocused = false
                case .sources:
                    isTextFocused = true
                    isAttachmentButtonFocused = false
                case nil:
                    isTextFocused = true
                    isAttachmentButtonFocused = true
                }
            }
        }
        .onChange(of: interaction.attachmentReadySequence) { _, _ in
            let addedCount = interaction.lastReadyAttachmentCount
            guard addedCount > 0 else { return }
            attachmentReadyFeedback += 1
            announceAccessibility(
                addedCount == 1 ? "Attachment ready" : "\(addedCount) attachments ready"
            )
        }
        .fileImporter(
            isPresented: $interaction.isFileImporterPresented,
            allowedContentTypes: [.data],
            allowsMultipleSelection: true
        ) { result in
            switch result {
            case .success(let urls):
                interaction.stageImportedFiles(urls)
                isTextFocused = true
            case .failure(let error): interaction.errorMessage = error.localizedDescription
            }
        }
        .onDisappear {
            guard interaction.overlay == nil, !interaction.isFileImporterPresented else { return }
            interaction.cleanUp()
        }
    }

    private var composerStack: some View {
        VStack(alignment: .leading, spacing: 8) {
            statusView
            composerSurface
        }
    }

    @ViewBuilder
    private var composerSurface: some View {
        if #available(iOS 26, macOS 26, *) {
            composerContents
                .padding(.horizontal, 10)
                .padding(.vertical, isExpanded ? 9 : 5)
                .glassEffect(
                    .regular.tint(Color.primary.opacity(0.04)).interactive(),
                    in: .rect(cornerRadius: surfaceCornerRadius)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: surfaceCornerRadius, style: .continuous)
                        .strokeBorder(.white.opacity(0.88), lineWidth: 1)
                }
                .shadow(color: .black.opacity(0.047), radius: 22, y: 9)
        } else {
            composerContents
                .padding(.horizontal, 10)
                .padding(.vertical, isExpanded ? 9 : 6)
                .background(
                    GrottoPlatformColor.inputSurface,
                    in: .rect(cornerRadius: surfaceCornerRadius)
                )
                .shadow(color: .black.opacity(0.06), radius: 14, y: 6)
        }
    }

    private var composerContents: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !interaction.attachments.isEmpty || interaction.isPreparingAttachment {
                attachmentStrip.transition(.move(edge: .bottom).combined(with: .opacity))
            }

            ComposerControlLayout(expansion: isExpanded ? 1 : 0) {
                attachmentButton
                messageField
                sendButton
            }
        }
    }

    private var messageField: some View {
        ZStack(alignment: .leading) {
            if text.isEmpty {
                Text(placeholder)
                    .foregroundStyle(GrottoPlatformColor.secondaryLabel)
                    .lineLimit(1)
                    .allowsHitTesting(false)
            }

            TextField("", text: $text, axis: .vertical)
                .foregroundStyle(.primary)
                .focused($isTextFocused)
                .lineLimit(1...6)
        }
        .clipped()
    }

    private var sendButton: some View {
        Button(action: submit) {
            Image(systemName: "arrow.up")
                .font(.body.weight(.bold))
                .frame(width: 34, height: 34)
                .foregroundStyle(
                    canSend ? GrottoPlatformColor.background : GrottoPlatformColor.secondaryLabel
                )
                .background(canSend ? Color.primary : .clear, in: .circle)
        }
        .buttonStyle(.plain)
        .disabled(!canSend)
        .accessibilityLabel("Send message")
    }

    private var attachmentButton: some View {
        Button {
            withAnimation(.spring(response: 0.32, dampingFraction: 0.9)) {
                interaction.overlay = interaction.overlay == nil ? .sources : nil
            }
        } label: {
            Image(systemName: "plus")
                .font(.title3.weight(.regular))
                .frame(width: 32, height: 32)
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .foregroundStyle(.primary)
        .disabled(!allowsAttachments || interaction.remainingCapacity == 0)
        .accessibilityLabel("Add attachment")
        .accessibilityFocused($isAttachmentButtonFocused)
    }

    private var attachmentStrip: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 4) {
                ForEach(interaction.attachments) { attachment in
                    attachmentTile(attachment)
                }
                if interaction.isPreparingAttachment {
                    ProgressView()
                        .frame(width: 88, height: 88)
                        .background(.quaternary, in: .rect(cornerRadius: 14))
                        .accessibilityLabel("Preparing attachment")
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    private func attachmentTile(_ attachment: ComposerAttachment) -> some View {
        let isTransitionDestination = interaction.morphingAttachmentID == attachment.id
        return ComposerAttachmentTile(
            attachment: attachment,
            transitionNamespace: transitionNamespace,
            isTransitionDestination: false
        ) {
            announceAccessibility("Removed \(attachment.filename)")
            interaction.remove(attachment)
        }
        .opacity(isTransitionDestination ? 0 : 1)
        .background {
            if isTransitionDestination {
                GeometryReader { geometry in
                    Color.clear
                        .onAppear { reportDestinationFrame(geometry) }
                        .onChange(of: geometry.frame(in: .named("composer-attachment-root"))) {
                            _, _ in reportDestinationFrame(geometry)
                        }
                }
            }
        }
    }

    private func reportDestinationFrame(_ geometry: GeometryProxy) {
        interaction.morphDestinationFrame = geometry.frame(in: .named("composer-attachment-root"))
    }

    @ViewBuilder
    private var statusView: some View {
        if let error = interaction.errorMessage {
            Text(error).font(.caption).foregroundStyle(.red).padding(.horizontal, 12)
        } else if !isConnected {
            ConnectionStatusBanner()
                .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    private var canSend: Bool {
        !interaction.isPreparingAttachment
            && (!text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                || !interaction.attachments.isEmpty)
    }

    private var isExpanded: Bool {
        Self.shouldExpand(
            isFocused: isTextFocused,
            hasAttachments: !interaction.attachments.isEmpty,
            isPreparingAttachment: interaction.isPreparingAttachment
        )
    }

    private var surfaceCornerRadius: CGFloat { isExpanded ? 26 : 24 }

    static func shouldExpand(
        isFocused: Bool,
        hasAttachments: Bool,
        isPreparingAttachment: Bool
    ) -> Bool {
        isFocused || hasAttachments || isPreparingAttachment
    }

    private func submit() {
        let content = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let submittedAttachments = interaction.attachments
        guard !content.isEmpty || !submittedAttachments.isEmpty else { return }

        text = ""
        interaction.attachments = []
        interaction.errorMessage = nil
        Task {
            if await onSend(content, submittedAttachments) {
                submittedAttachments.forEach(ComposerAttachmentStager.remove)
                return
            }
            text = text.isEmpty ? content : [content, text].filter { !$0.isEmpty }.joined(separator: "\n")
            interaction.attachments = submittedAttachments + interaction.attachments
            interaction.errorMessage = "Message not sent. Your draft is ready to retry."
        }
    }

    private func announceAccessibility(_ message: String) {
        #if os(iOS)
        UIAccessibility.post(notification: .announcement, argument: message)
        #endif
    }
}

/// Keeps composer controls alive while their positions interpolate between compact and focused UI.
struct ComposerControlLayout: Layout {
    var expansion: CGFloat

    var animatableData: CGFloat {
        get { expansion }
        set { expansion = newValue }
    }

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        guard subviews.count == 3 else { return .zero }
        return metrics(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        guard subviews.count == 3 else { return }
        let layout = metrics(
            proposal: ProposedViewSize(width: bounds.width, height: proposal.height),
            subviews: subviews
        )

        for (subview, frame) in zip(subviews, layout.frames) {
            subview.place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                anchor: .topLeading,
                proposal: ProposedViewSize(frame.size)
            )
        }
    }

    private func metrics(proposal: ProposedViewSize, subviews: Subviews) -> Metrics {
        let progress = min(max(expansion, 0), 1)
        let stagedProgress = Self.stagedProgress(for: progress)
        let controlsProgress = stagedProgress.controls
        let fieldProgress = stagedProgress.field
        let attachmentSize = subviews[0].sizeThatFits(.unspecified)
        let sendSize = subviews[2].sizeThatFits(.unspecified)
        let proposedWidth = proposal.width
            ?? attachmentSize.width + sendSize.width + 180
        let compactFieldWidth = max(
            0,
            proposedWidth - attachmentSize.width - sendSize.width - 16
        )
        let expandedFieldWidth = max(0, proposedWidth - 12)
        let expandedFieldSize = subviews[1].sizeThatFits(
            ProposedViewSize(width: expandedFieldWidth, height: proposal.height)
        )
        let compactFieldHeight = min(expandedFieldSize.height, 24)
        let fieldWidth = interpolate(
            compactFieldWidth,
            expandedFieldWidth,
            progress: fieldProgress
        )
        let fieldHeight = interpolate(
            compactFieldHeight,
            expandedFieldSize.height,
            progress: fieldProgress
        )
        let controlsHeight = max(attachmentSize.height, sendSize.height)
        let compactHeight = max(34, controlsHeight, compactFieldHeight)
        let expandedTopHeight = max(36, expandedFieldSize.height)
        let expandedHeight = expandedTopHeight + 8 + controlsHeight
        let totalHeight = interpolate(compactHeight, expandedHeight, progress: progress)

        let attachmentFrame = CGRect(
            x: 0,
            y: interpolate(
                (compactHeight - attachmentSize.height) / 2,
                expandedTopHeight + 8 + (controlsHeight - attachmentSize.height) / 2,
                progress: controlsProgress
            ),
            width: attachmentSize.width,
            height: attachmentSize.height
        )
        let fieldFrame = CGRect(
            x: interpolate(attachmentSize.width + 8, 6, progress: fieldProgress),
            y: interpolate(
                (compactHeight - compactFieldHeight) / 2,
                0,
                progress: fieldProgress
            ),
            width: fieldWidth,
            height: fieldHeight
        )
        let sendFrame = CGRect(
            x: proposedWidth - sendSize.width,
            y: interpolate(
                (compactHeight - sendSize.height) / 2,
                expandedTopHeight + 8 + (controlsHeight - sendSize.height) / 2,
                progress: controlsProgress
            ),
            width: sendSize.width,
            height: sendSize.height
        )

        return Metrics(
            size: CGSize(width: proposedWidth, height: totalHeight),
            frames: [attachmentFrame, fieldFrame, sendFrame]
        )
    }

    private func interpolate(_ start: CGFloat, _ end: CGFloat, progress: CGFloat) -> CGFloat {
        start + ((end - start) * progress)
    }

    static func stagedProgress(for expansion: CGFloat) -> (controls: CGFloat, field: CGFloat) {
        let progress = min(max(expansion, 0), 1)
        let controls = min(progress / 0.6, 1)
        let field = max((progress - 0.45) / 0.55, 0)
        return (controls, field)
    }

    private struct Metrics {
        let size: CGSize
        let frames: [CGRect]
    }
}
