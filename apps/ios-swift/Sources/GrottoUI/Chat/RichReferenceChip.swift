import SwiftUI

/// The chip's interior at one box size: what the box can hold, and how big the
/// label has to be to belong to the sentence it sits in.
///
/// The box itself is not negotiable — an inline run taller than the line makes
/// its line taller than every other line in the body (`InlineChipFit`) — so the
/// mark and the insets are fractions of that height and the whole chip scales
/// with Dynamic Type. The label is the one measurement taken from the words
/// instead of from the box: at a fraction of the box it read as a shrunken
/// pill beside 17pt body text, so it follows the surrounding point size the way
/// the App's chip does, a shade under the body. It fits because a capsule sized
/// to the ascent holds a smaller font's caps with room to spare.
struct RichReferenceChipProportions: Hashable {
    /// The line-fit height from `InlineChipFit`.
    let height: CGFloat
    /// The label's point size.
    let labelSize: CGFloat
    /// The mark's edge, and its distance from the top, bottom, and leading
    /// edges of the box.
    let markSize: CGFloat
    let inset: CGFloat
    let markGap: CGFloat
    let trailingInset: CGFloat
    /// How far the label is drawn above where the box would center its line
    /// box, in points. The label's line box is taller than the capsule — a
    /// ~15pt line box inside a ~16.3pt box, once its descent is counted — so
    /// centering it hangs the descenders below the capsule's bottom edge,
    /// where `ImageRenderer` clips them flat. Lifting by the overhang rests
    /// the descenders on that edge instead.
    let labelLift: CGFloat
    /// The label's baseline, measured down from the top of the box.
    let labelBaseline: CGFloat

    /// The same `box / 3` curve `ChannelIconBox` gives the mark, which keeps
    /// the two corners concentric at any Dynamic Type size.
    var cornerRadius: CGFloat { height / 3 }

    init(height: CGFloat, textPointSize: CGFloat) {
        self.init(
            height: height,
            textPointSize: textPointSize,
            labelMetrics: PlatformTextMetrics.metrics(
                forPointSize: Self.labelPointSize(forText: textPointSize)
            )
        )
    }

    /// `labelMetrics` are the system font's metrics at `labelSize`.
    init(height: CGFloat, textPointSize: CGFloat, labelMetrics: PlatformFontMetrics) {
        self.height = height
        labelSize = Self.labelPointSize(forText: textPointSize)
        inset = height * Self.insetScale
        markSize = max(0, height - inset * 2)
        markGap = height * Self.markGapScale
        trailingInset = height * Self.trailingInsetScale

        // Where the baseline lands with the label's line box centered in the
        // capsule, which is what a plain `.frame(height:)` does.
        let centeredBaseline = (height - labelMetrics.lineHeight) / 2 + labelMetrics.ascent
        let overhang = max(0, (labelMetrics.lineHeight - height) / 2)
        // The lift never buys descender room at the cost of shearing the caps
        // off the top. SF at these sizes leaves several points of headroom, so
        // the clamp is a guard rather than a working limit.
        let headroom = max(0, centeredBaseline - labelMetrics.capHeight - Self.minimumCapHeadroom)
        labelLift = min(overhang, headroom)
        labelBaseline = centeredBaseline - labelLift
    }

    /// The label's point size for body text at `textPointSize`.
    static func labelPointSize(forText textPointSize: CGFloat) -> CGFloat {
        textPointSize * labelScale
    }

    /// The App's chip carries an 0.875 label inside 16px body text.
    private static let labelScale: CGFloat = 0.88
    /// A point and a half at default type, so a ~13pt mark fills a ~16pt box.
    private static let insetScale: CGFloat = 0.092
    private static let markGapScale: CGFloat = 0.18
    /// Wider than the leading inset: the mark's own round edge already reads
    /// as space, where the label's last glyph does not.
    private static let trailingInsetScale: CGFloat = 0.3
    /// A point of air over the capitals, which also keeps an accented capital
    /// from touching the capsule's top edge.
    private static let minimumCapHeadroom: CGFloat = 1
}

/// One reference chip. Every kind wears the same box; only the identity mark
/// and the label's ink differ — a channel carries its own glyph box and its
/// configured color, an Agent or human carries an avatar.
///
/// The chip is told its box rather than growing to its content, because an
/// inline run that outgrows the line box makes its line taller than every other
/// line in the body (`InlineChipFit`). `RichReferenceChipProportions` carries
/// that box and everything derived from it.
///
/// The chip is only ever drawn through `RichReferenceChipRaster`, which renders
/// it in one `ImageRenderer` pass.
struct RichReferenceChip: View {
    let reference: RichReferencePresentation
    let proportions: RichReferenceChipProportions

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.legibilityWeight) private var legibilityWeight

    var body: some View {
        HStack(spacing: proportions.markGap) {
            mark
            Text(reference.label)
                .font(.system(size: proportions.labelSize, weight: labelWeight))
                .foregroundStyle(labelTint)
                .lineLimit(1)
                // Nothing may compress the label's line box; the lift is
                // measured against its full height.
                .fixedSize()
                // Layout is untouched, so the mark stays centered in the box
                // while only the label rides up.
                .offset(y: -proportions.labelLift)
        }
        .padding(.leading, proportions.inset)
        .padding(.trailing, proportions.trailingInset)
        .frame(height: proportions.height)
        .background(
            ground,
            in: .rect(cornerRadius: proportions.cornerRadius, style: .continuous)
        )
    }

    @ViewBuilder
    private var mark: some View {
        switch reference.kind {
        case .channel:
            ChannelIconBox(appearance: appearance, size: proportions.markSize)
        case .agent, .human:
            AvatarView(
                name: reference.label,
                url: reference.avatarURL,
                size: proportions.markSize
            )
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

    private var labelWeight: Font.Weight {
        legibilityWeight == .bold ? .bold : .medium
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
}

extension MentionPresentationKind {
    /// How a chip names itself to VoiceOver.
    var referenceKindLabel: String {
        switch self {
        case .agent: "Agent"
        case .channel: "Channel"
        case .human: "Human"
        }
    }
}
