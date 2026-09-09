import SwiftUI

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// The brand ink an appearance override gives a reference's mark, mirroring the
/// App's `brandColor`.
///
/// One case, because the App names one brand: Chrome, in the `--success` token,
/// which resolves to the same green under both themes.
public enum ReferenceBrandInk: Hashable, Sendable {
    case success

    public var color: Color {
        switch self {
        case .success: Color(red: 0x17 / 255, green: 0xC9 / 255, blue: 0x64 / 255)
        }
    }
}

/// The capsule drawn behind a reference run, in the body font's own metrics.
///
/// Nothing here may change the line. The capsule is exactly the line's own box
/// — the font's ascent above the baseline and its descent below — so the label
/// sits on the same baseline as the words beside it, at the same size, and a
/// line carrying a mention keeps the pitch of a line of plain words. The mark
/// and the insets are fractions of that box, so the whole chip scales with
/// Dynamic Type, and the horizontal room they need is bought inside the text
/// itself by the two spacer runs `RichMessageAttributedText` writes around the
/// label.
struct RichReferenceCapsuleGeometry: Equatable {
    /// The body font's ascent and descent, both positive.
    let ascent: CGFloat
    let descent: CGFloat
    /// The identity mark's edge, and its distance from the capsule's top,
    /// bottom, and leading edges.
    let markSize: CGFloat
    let leadingInset: CGFloat
    /// The gap between the mark and the label.
    let markGap: CGFloat
    let trailingInset: CGFloat

    /// The capsule's height: the line's own box.
    var height: CGFloat { ascent + descent }
    /// The same `box / 3` curve `ChannelIconBox` gives the mark, which keeps
    /// the two corners concentric at any Dynamic Type size.
    var cornerRadius: CGFloat { height / 3 }
    /// Blank advance written before the label, holding the leading inset, the
    /// mark, and the gap after it.
    var leadingSpacer: CGFloat { leadingInset + markSize + markGap }
    /// Blank advance written after the label, so the next word does not sit on
    /// the capsule's trailing edge.
    var trailingSpacer: CGFloat { trailingInset }

    init(metrics: PlatformFontMetrics) {
        ascent = metrics.ascent
        descent = metrics.descent
        let box = metrics.ascent + metrics.descent
        leadingInset = max(Self.minimumInset, box * Self.insetScale)
        markSize = max(1, box - leadingInset * 2)
        markGap = box * Self.markGapScale
        trailingInset = box * Self.trailingInsetScale
    }

    /// The capsule behind a run whose leading edge is `leadingX` and whose
    /// baseline is `baselineY`, both in the text container's coordinates.
    func capsuleRect(leadingX: CGFloat, baselineY: CGFloat, width: CGFloat) -> CGRect {
        CGRect(x: leadingX, y: baselineY - ascent, width: width, height: height)
    }

    /// The mark's box, inset from the capsule's leading edge and centered on
    /// its height. `scale` shrinks a mark that the App draws smaller than the
    /// rest — the three-sparkle Skill glyph — around the same center, so the
    /// label still starts where every other reference's does.
    func markRect(in capsule: CGRect, scale: CGFloat = 1) -> CGRect {
        let size = markSize * scale
        return CGRect(
            x: capsule.minX + leadingInset + (markSize - size) / 2,
            y: capsule.midY - size / 2,
            width: size,
            height: size
        )
    }

    /// A tenth of the box, which leaves a ~16pt mark inside 17pt body text —
    /// twice the font's x-height, near enough, the way the App pairs an 18px
    /// mark with 16px text.
    private static let insetScale: CGFloat = 0.1
    /// A point and a half, so the smallest type sizes keep a visible inset.
    private static let minimumInset: CGFloat = 1.5
    private static let markGapScale: CGFloat = 0.18
    /// A hair wider than the leading inset, and well under a word space: the
    /// web chip carries no inline padding at all, so punctuation must hug the
    /// capsule rather than read as a stray space after the label.
    private static let trailingInsetScale: CGFloat = 0.15
}

/// The chip's ink.
///
/// Every iOS value is a dynamic color, so a color-scheme change repaints the
/// body without rebuilding its attributed string.
enum RichReferenceChipInk {
    #if canImport(UIKit)
    static var bodyText: UIColor { .label }

    /// A link this client does not chip reads in the system's own link ink, the
    /// nearest thing iOS has to the App's anchor color.
    static var linkText: UIColor { .link }

    /// A translucent wash of the foreground, never an opaque grey, so the chip
    /// composites over whatever it sits on. Light stays under the neutral
    /// `ChannelIconBox` fill so the chip reads quieter than its own mark.
    static var ground: UIColor {
        UIColor { traits in
            UIColor.label
                .resolvedColor(with: traits)
                .withAlphaComponent(traits.userInterfaceStyle == .dark ? 0.12 : 0.055)
        }
    }

    /// A brand reads in its brand's ink, a channel in its own configured color,
    /// and a skill in the App's dedicated purple. A channel with no preset, and
    /// every other kind, reads as ordinary ink — which is what the App's
    /// default chip foreground resolves to in both themes.
    static func labelTint(for reference: RichReferencePresentation) -> UIColor {
        if case .brandGlyph(_, let brand) = reference.mark { return brandTint(brand) }
        if reference.kind == .skill { return skillReference }
        guard reference.kind == .channel, let preset = preset(for: reference) else {
            return .label
        }
        return dynamic(light: preset.light, dark: preset.dark)
    }

    /// A brand mark's own ink. The App's `brandColor` lands on `--chip-fg`, so
    /// it inks the whole chip foreground — the mark and the label both.
    static func brandTint(_ brand: ReferenceBrandInk) -> UIColor { UIColor(brand.color) }

    /// The App's `--skill-reference` product token, whose two ramp stops
    /// `SkillReferenceInk` names once for every surface that draws a Skill.
    static var skillReference: UIColor {
        dynamic(light: SkillReferenceInk.light, dark: SkillReferenceInk.dark)
    }

    /// The App derives the mark's box from the glyph tint at 11% light / 13%
    /// dark; an unset or unknown color renders the neutral `default` token.
    static func markGround(for appearance: ChannelAppearance) -> UIColor {
        guard let preset = ChannelColorPalette.preset(for: appearance.color) else {
            return UIColor { traits in
                UIColor.label
                    .resolvedColor(with: traits)
                    .withAlphaComponent(traits.userInterfaceStyle == .dark ? 0.12 : 0.075)
            }
        }
        return dynamic(light: preset.light.opacity(0.11), dark: preset.dark.opacity(0.13))
    }

    static func markTint(for appearance: ChannelAppearance) -> UIColor {
        guard let preset = ChannelColorPalette.preset(for: appearance.color) else {
            return .secondaryLabel
        }
        return dynamic(light: preset.light, dark: preset.dark)
    }

    /// `AvatarView`'s initials look: a muted disc under the accent tint.
    static var initialsGround: UIColor {
        UIColor { traits in
            UIColor.secondaryLabel.resolvedColor(with: traits).withAlphaComponent(0.1)
        }
    }

    static var initialsTint: UIColor { .tintColor }

    private static func dynamic(light: Color, dark: Color) -> UIColor {
        let lightColor = UIColor(light)
        let darkColor = UIColor(dark)
        return UIColor { $0.userInterfaceStyle == .dark ? darkColor : lightColor }
    }
    #elseif canImport(AppKit)
    // macOS hosts the package for `swift test` only; the stand-in body draws
    // labels without a capsule, so these are the light values, flat.
    static var bodyText: NSColor { .labelColor }
    static var ground: NSColor { NSColor.labelColor.withAlphaComponent(0.055) }
    static var linkText: NSColor { .linkColor }

    static func brandTint(_ brand: ReferenceBrandInk) -> NSColor { NSColor(brand.color) }

    static func labelTint(for reference: RichReferencePresentation) -> NSColor {
        if case .brandGlyph(_, let brand) = reference.mark { return brandTint(brand) }
        if reference.kind == .skill {
            return NSColor(SkillReferenceInk.light)
        }
        guard reference.kind == .channel, let preset = preset(for: reference) else {
            return .labelColor
        }
        return NSColor(preset.light)
    }
    #endif

    private static func preset(for reference: RichReferencePresentation) -> ChannelColorPreset? {
        ChannelColorPalette.preset(for: (reference.channelAppearance ?? .default).color)
    }
}
