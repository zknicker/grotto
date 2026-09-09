import CoreGraphics
import Foundation

/// What a reference draws around its label: the identity mark before it and the
/// dotted underline beneath it, in the body font's own metrics.
///
/// Nothing here may change the line. A reference has no ground of its own — the
/// App's chip is the transparent `tertiary` shell at `padding: 0`, so the label
/// sits in the sentence at the sentence's size on the sentence's baseline, and
/// the only room bought inside the text is the leading spacer holding the mark
/// and the gap after it. The mark and the underline are fractions of the line's
/// own box, so the whole reference scales with Dynamic Type.
struct RichReferenceMarkGeometry: Equatable {
    /// The body font's ascent and descent, both positive.
    let ascent: CGFloat
    let descent: CGFloat
    /// The identity mark's edge.
    let markSize: CGFloat
    /// The gap between the mark and the label: the App's own `--spacing` step.
    let markGap: CGFloat
    /// The dotted rule under the label's glyphs.
    let underline: RichReferenceUnderline

    /// The line's own box: the font's ascent above the baseline and its descent
    /// below. The mark is centered on it and the underline hangs inside it.
    var lineBox: CGFloat { ascent + descent }

    /// Blank advance written before the label, holding the mark and the gap
    /// after it. There is no leading inset, because there is no box to inset
    /// from.
    var leadingSpacer: CGFloat { markSize + markGap }

    init(metrics: PlatformFontMetrics) {
        ascent = metrics.ascent
        descent = metrics.descent
        markSize = max(1, (metrics.ascent + metrics.descent) * Self.markScale)
        markGap = metrics.pointSize * Self.markGapScale
        underline = RichReferenceUnderline(
            pointSize: metrics.pointSize,
            descent: metrics.descent
        )
    }

    /// The mark's box: its leading edge on the run's own leading edge, centered
    /// on the line's box. `scale` shrinks a mark the App draws smaller than the
    /// rest — the three-sparkle Skill glyph — around the same center, so the
    /// label still starts where every other reference's does.
    func markRect(leadingX: CGFloat, baselineY: CGFloat, scale: CGFloat = 1) -> CGRect {
        let size = markSize * scale
        return CGRect(
            x: leadingX + (markSize - size) / 2,
            y: baselineY - ascent + (lineBox - size) / 2,
            width: size,
            height: size
        )
    }

    /// Four fifths of the line's box, which leaves a ~16pt mark inside 17pt body
    /// text — twice the font's x-height, near enough. The fraction is capped by
    /// the box rather than borrowed from the App: the text view clips to the
    /// height it reports, so a mark taller than the line would be cut off on the
    /// first and last rows.
    private static let markScale: CGFloat = 0.8
    /// The App's `--spacing` (3.75px beside its 14px body), read as a fraction
    /// of the point size so it travels with Dynamic Type.
    private static let markGapScale: CGFloat = 0.25
}

/// The dotted rule under a reference's label.
///
/// The App draws it as a repeating radial gradient — a `0.12em` dot every
/// `0.24em`, in the label's own ink — under the label's glyphs alone. The dot's
/// half-of-the-period rhythm carries over exactly; the size does not, because
/// the App spends its paragraph's `1.6` leading on the gap under the words and
/// the phone has none to spend. So the dots are thinner and hang on the line's
/// own floor, which is where UIKit puts an underline too, rather than below it:
/// the text view clips to the height it reports, and a rule under the last line
/// would otherwise be cut in half.
struct RichReferenceUnderline: Equatable {
    /// A dot's diameter, which is also the rule's thickness.
    let diameter: CGFloat
    /// Center to center, twice the diameter: the App's `0.12em` dot in a
    /// `0.24em` tile.
    let period: CGFloat
    /// How far below the baseline the dots' centers sit.
    let centerDepth: CGFloat

    init(pointSize: CGFloat, descent: CGFloat) {
        diameter = max(1, pointSize * Self.diameterScale)
        period = diameter * 2
        // Flush with the line's floor: the dots clear the descenders they can
        // and stay inside the box the row was measured at.
        centerDepth = max(diameter / 2, descent - diameter / 2)
    }

    /// The dots' centers across a label running from `fromX` to `toX`.
    ///
    /// The App tiles from the label's leading edge with the dot centered in its
    /// tile, so the first dot sits half a period in. A dot that would not fit
    /// whole is dropped rather than drawn clipped, which is the one place the
    /// phone reads better than a background that repeats past its box.
    func dotCenters(fromX: CGFloat, toX: CGFloat) -> [CGFloat] {
        guard period > 0, toX > fromX else { return [] }
        var centers: [CGFloat] = []
        var center = fromX + period / 2
        while center + diameter / 2 <= toX {
            centers.append(center)
            center += period
        }
        return centers
    }

    /// A dot's box, centered on `centerX` at the depth below `baselineY` the
    /// rule hangs at.
    func dotRect(centerX: CGFloat, baselineY: CGFloat) -> CGRect {
        CGRect(
            x: centerX - diameter / 2,
            y: baselineY + centerDepth - diameter / 2,
            width: diameter,
            height: diameter
        )
    }

    /// Nine hundredths of the point size: a hair heavier than the system's own
    /// underline, which is what a dotted rule needs to read as one.
    private static let diameterScale: CGFloat = 0.09
}
