import SwiftUI

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// The vertical metrics of the system font behind a `Font.TextStyle`.
struct PlatformFontMetrics: Equatable {
    /// The size the text style resolves to at this Dynamic Type size.
    let pointSize: CGFloat
    /// Height above the baseline, positive.
    let ascent: CGFloat
    /// Depth below the baseline, positive.
    let descent: CGFloat
    /// The gap a line adds beyond `ascent + descent`, positive.
    let leading: CGFloat
    let xHeight: CGFloat
    /// The height of a capital, positive: the top of the label's ink.
    let capHeight: CGFloat

    var lineHeight: CGFloat { ascent + descent + leading }
}

/// Resolved metrics for the system font behind a `Font.TextStyle`.
///
/// SwiftUI does not expose the font it resolves, and inline chip placement
/// needs the real line box, so the platform font is asked for the same style at
/// the same Dynamic Type size.
enum PlatformTextMetrics {
    static func metrics(
        for style: Font.TextStyle,
        dynamicTypeSize: DynamicTypeSize
    ) -> PlatformFontMetrics {
        #if canImport(UIKit)
        let font = UIFont.preferredFont(
            forTextStyle: uiTextStyle(style),
            compatibleWith: UITraitCollection(
                preferredContentSizeCategory: contentSizeCategory(dynamicTypeSize)
            )
        )
        return measure(font)
        #elseif canImport(AppKit)
        // macOS has no Dynamic Type; the style resolves to one size.
        return measure(NSFont.preferredFont(forTextStyle: nsTextStyle(style)))
        #endif
    }

    /// Metrics for the system font at an explicit point size.
    ///
    /// The chip's label is the one run whose size comes from the surrounding
    /// text rather than from a text style, and placing it inside the capsule
    /// needs its real line box. Weight is not asked for: SF's ascent, descent,
    /// and cap height are the same at every weight of a given size.
    static func metrics(forPointSize pointSize: CGFloat) -> PlatformFontMetrics {
        #if canImport(UIKit)
        return measure(UIFont.systemFont(ofSize: pointSize))
        #elseif canImport(AppKit)
        return measure(NSFont.systemFont(ofSize: pointSize))
        #endif
    }

    #if canImport(UIKit)
    private static func measure(_ font: UIFont) -> PlatformFontMetrics {
        PlatformFontMetrics(
            pointSize: font.pointSize,
            ascent: font.ascender,
            descent: -font.descender,
            leading: max(0, font.lineHeight - font.ascender + font.descender),
            xHeight: font.xHeight,
            capHeight: font.capHeight
        )
    }

    private static func uiTextStyle(_ style: Font.TextStyle) -> UIFont.TextStyle {
        switch style {
        case .largeTitle: .largeTitle
        case .title: .title1
        case .title2: .title2
        case .title3: .title3
        case .headline: .headline
        case .subheadline: .subheadline
        case .callout: .callout
        case .footnote: .footnote
        case .caption: .caption1
        case .caption2: .caption2
        default: .body
        }
    }

    private static func contentSizeCategory(_ size: DynamicTypeSize) -> UIContentSizeCategory {
        switch size {
        case .xSmall: .extraSmall
        case .small: .small
        case .medium: .medium
        case .large: .large
        case .xLarge: .extraLarge
        case .xxLarge: .extraExtraLarge
        case .xxxLarge: .extraExtraExtraLarge
        case .accessibility1: .accessibilityMedium
        case .accessibility2: .accessibilityLarge
        case .accessibility3: .accessibilityExtraLarge
        case .accessibility4: .accessibilityExtraExtraLarge
        case .accessibility5: .accessibilityExtraExtraExtraLarge
        default: .large
        }
    }
    #elseif canImport(AppKit)
    private static func measure(_ font: NSFont) -> PlatformFontMetrics {
        PlatformFontMetrics(
            pointSize: font.pointSize,
            ascent: font.ascender,
            descent: -font.descender,
            leading: max(0, font.leading),
            xHeight: font.xHeight,
            capHeight: font.capHeight
        )
    }

    private static func nsTextStyle(_ style: Font.TextStyle) -> NSFont.TextStyle {
        switch style {
        case .largeTitle: .largeTitle
        case .title: .title1
        case .title2: .title2
        case .title3: .title3
        case .headline: .headline
        case .subheadline: .subheadline
        case .callout: .callout
        case .footnote: .footnote
        case .caption: .caption1
        case .caption2: .caption2
        default: .body
        }
    }
    #endif
}

/// How tall an inline chip may be, and how far below the baseline it may hang,
/// without making its line taller than a line of plain words.
struct InlineChipFit: Equatable {
    /// The exact height the chip is drawn at.
    let height: CGFloat
    /// Negative: the distance the image run is dropped.
    let baselineOffset: CGFloat

    /// Measured behavior of the SwiftUI text engine, which the arithmetic here
    /// answers: a line absorbs an image run's above-baseline extent only up to
    /// the font's ascent plus its leading, and absorbs no baseline offset at
    /// all — every point of offset, up or down, is added to the line. So a chip
    /// centered on the x-height the way web `align-middle` centers one would
    /// cost its line about four points of extra pitch. The chip is instead
    /// sized to that absorption ceiling and dropped only as far as the pitch
    /// tolerance below buys, which rests it on the words rather than floating
    /// it above them.
    init(metrics: PlatformFontMetrics, displayScale: CGFloat) {
        let scale = displayScale > 0 ? displayScale : 1
        // Floored to a whole pixel so the rasterizer cannot round the chip
        // back over the ceiling it was sized against.
        let ceiling = (metrics.ascent + metrics.leading) * scale
        height = max(1, ceiling.rounded(.down) / scale)
        let centering = max(0, (height - metrics.xHeight) / 2)
        baselineOffset = -min(centering, metrics.lineHeight * Self.pitchTolerance)
    }

    /// How much taller than a plain line a line carrying this chip becomes.
    func lineGrowth(_ metrics: PlatformFontMetrics) -> CGFloat {
        max(0, height - metrics.ascent - metrics.leading) - baselineOffset
    }

    /// A twentieth of the line — one point at default type — spent on the drop.
    private static let pitchTolerance: CGFloat = 0.05
}
