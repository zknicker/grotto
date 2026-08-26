import SwiftUI

struct RichMessageContentView: View {
    let segments: [RichMessageSegment]

    var body: some View {
        RichMessageFlowLayout(spacing: 4) {
            ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
                switch segment {
                case .text(let text):
                    Text(text)
                        .font(.body)
                        .textSelection(.enabled)
                case .reference(let reference):
                    HStack(spacing: 4) {
                        AvatarView(name: reference.label, url: reference.avatarURL, size: 16)
                        Text(reference.label)
                            .font(.callout.weight(.medium))
                            .lineLimit(1)
                    }
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(.quaternary, in: .capsule)
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(
                        "\(reference.kind == .agent ? "Agent" : "Human") reference, \(reference.label)"
                    )
                }
            }
        }
    }
}

private struct RichMessageFlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        layout(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let result = layout(proposal: proposal, subviews: subviews)
        for (index, point) in result.points.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y),
                anchor: .topLeading,
                proposal: ProposedViewSize(result.sizes[index])
            )
        }
    }

    private func layout(
        proposal: ProposedViewSize,
        subviews: Subviews
    ) -> (size: CGSize, points: [CGPoint], sizes: [CGSize]) {
        let maxWidth = proposal.width ?? .infinity
        var points: [CGPoint] = []
        var sizes: [CGSize] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.init(width: maxWidth, height: nil))
            sizes.append(size)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            points.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return (CGSize(width: proposal.width ?? x, height: y + rowHeight), points, sizes)
    }
}
