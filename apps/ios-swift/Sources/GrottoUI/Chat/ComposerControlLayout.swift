import SwiftUI

extension MessageComposerView {
    static func shouldExpand(
        isFocused: Bool,
        hasAttachments: Bool,
        isPreparingAttachment: Bool
    ) -> Bool {
        isFocused || hasAttachments || isPreparingAttachment
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
        let proposedWidth = proposal.width ?? attachmentSize.width + sendSize.width + 180
        let compactFieldWidth = max(0, proposedWidth - attachmentSize.width - sendSize.width - 16)
        let expandedFieldWidth = max(0, proposedWidth - 12)
        let expandedFieldSize = subviews[1].sizeThatFits(
            ProposedViewSize(width: expandedFieldWidth, height: proposal.height)
        )
        let compactFieldHeight = min(expandedFieldSize.height, 24)
        let fieldWidth = interpolate(compactFieldWidth, expandedFieldWidth, progress: fieldProgress)
        let fieldHeight = interpolate(compactFieldHeight, expandedFieldSize.height, progress: fieldProgress)
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
            y: interpolate((compactHeight - compactFieldHeight) / 2, 0, progress: fieldProgress),
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
        return (min(progress / 0.6, 1), max((progress - 0.45) / 0.55, 0))
    }

    private struct Metrics {
        let size: CGSize
        let frames: [CGRect]
    }
}
