import SwiftUI

struct RichMessageContentView: View {
    let segments: [RichMessageSegment]
    var font: Font = .body

    var body: some View {
        RichMessageFlowLayout(spacing: 4) {
            ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
                switch segment {
                case .text(let text):
                    Text(text)
                        .font(font)
                        .textSelection(.enabled)
                case .reference(let reference):
                    RichReferenceChip(reference: reference)
                }
            }
        }
    }
}

/// One reference chip. Every kind wears the same box; only the identity mark
/// and the label's ink differ — a channel carries its own glyph box and its
/// configured color, an Agent or human carries an avatar.
///
/// The box is sized by its content, so its insets and its corner are derived
/// from the height that content produces rather than guessed: the mark sits the
/// same distance from the leading edge as it does from the top and bottom, and
/// the corner follows the same `box / 3` curve `ChannelIconBox` gives the mark,
/// which keeps the two corners concentric at any Dynamic Type size.
private struct RichReferenceChip: View {
    let reference: RichReferencePresentation

    @Environment(\.colorScheme) private var colorScheme
    @ScaledMetric(relativeTo: .callout) private var estimatedContentHeight: CGFloat = 21
    @State private var measuredContentHeight: CGFloat?

    private static let markSize: CGFloat = 16
    private static let verticalInset: CGFloat = 3
    private static let trailingInset: CGFloat = 8

    var body: some View {
        HStack(spacing: 4) {
            mark
            Text(reference.label)
                .font(.callout.weight(.medium))
                .foregroundStyle(labelTint)
                .lineLimit(1)
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
            measuredContentHeight = height
        }
        .padding(.vertical, Self.verticalInset)
        .padding(.leading, markInset)
        .padding(.trailing, Self.trailingInset)
        .background(ground, in: .rect(cornerRadius: cornerRadius, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(kindLabel) reference, \(reference.label)")
    }

    @ViewBuilder
    private var mark: some View {
        switch reference.kind {
        case .channel:
            ChannelIconBox(appearance: appearance, size: Self.markSize)
        case .agent, .human:
            AvatarView(name: reference.label, url: reference.avatarURL, size: Self.markSize)
        }
    }

    private var appearance: ChannelAppearance {
        reference.channelAppearance ?? .default
    }

    /// A translucent wash of the foreground, never an opaque grey, so the chip
    /// composites over whatever it sits on. Light stays under the neutral
    /// `ChannelIconBox` fill so the chip reads quieter than its own mark.
    private var ground: Color {
        Color.primary.opacity(colorScheme == .dark ? 0.12 : 0.055)
    }

    private var chipHeight: CGFloat {
        (measuredContentHeight ?? max(Self.markSize, estimatedContentHeight))
            + Self.verticalInset * 2
    }

    /// The mark's distance from the top and bottom edges, reused as its
    /// distance from the leading edge.
    private var markInset: CGFloat {
        max(Self.verticalInset, (chipHeight - Self.markSize) / 2)
    }

    private var cornerRadius: CGFloat {
        chipHeight / 3
    }

    /// A channel reads in its own configured color. A channel with no preset,
    /// and every other kind, reads as ordinary ink.
    private var labelTint: Color {
        guard reference.kind == .channel,
              let preset = ChannelColorPalette.preset(for: appearance.color) else {
            return .primary
        }
        return preset.tint(colorScheme)
    }

    private var kindLabel: String {
        switch reference.kind {
        case .agent: "Agent"
        case .channel: "Channel"
        case .human: "Human"
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
