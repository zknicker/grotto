import CoreGraphics
import SwiftUI

/// A rasterized reference chip: its bitmap and the size it occupies in points.
struct RichReferenceChipImage {
    let image: CGImage
    let size: CGSize
}

/// Everything a chip's pixels depend on beyond the reference itself.
struct RichReferenceChipStyle: Hashable {
    let colorScheme: ColorScheme
    let displayScale: CGFloat
    let dynamicTypeSize: DynamicTypeSize
    /// Accessibility Bold Text, which the chip's label answers.
    let legibilityWeight: LegibilityWeight?
    /// The box the chip is drawn in and everything derived from it, including
    /// the label size the surrounding text asked for.
    let proportions: RichReferenceChipProportions
    /// Whether the avatar bytes are available to `AvatarImageCache`. A chip
    /// drawn on its initials and a chip drawn on its avatar are different
    /// pixels.
    let hasAvatarImage: Bool
    /// Whether `ChannelIconCatalog` can already answer for this channel's glyph.
    let hasChannelGlyph: Bool
}

/// Draws reference chips into bitmaps and remembers them.
///
/// A chip has to reach a message body as one glyph inside its `Text`, so it is
/// rendered once through `ImageRenderer` at the display scale and reused. Every
/// input that changes those pixels is part of the key — the reference, the
/// color scheme, Dynamic Type, Bold Text, the display scale, the chip's
/// proportions, and whether the avatar or channel glyph has finished loading —
/// so an asynchronous arrival draws a new chip instead of reviving a stale one,
/// and a scrolling transcript redraws nothing it has already seen.
@MainActor
final class RichReferenceChipRaster {
    static let shared = RichReferenceChipRaster()

    /// Bounded by pixels rather than entries: a count limit evicts a cheap
    /// chip and a huge one alike, and re-rasterizing on a back-scroll happens
    /// synchronously inside cell layout. `NSCache` also drops everything under
    /// memory pressure, which a plain dictionary never did.
    private let images = NSCache<CacheKey, ImageBox>()

    init() {
        images.totalCostLimit = 12 * 1024 * 1024
    }

    /// The chip for this reference and style, rendering it on first use. Nil
    /// when the renderer cannot produce a bitmap; the caller falls back to the
    /// plain label rather than dropping the reference.
    func image(
        for reference: RichReferencePresentation,
        style: RichReferenceChipStyle
    ) -> RichReferenceChipImage? {
        let key = CacheKey(reference: reference, style: style)
        if let cached = images.object(forKey: key) {
            return cached.value
        }
        guard let rendered = Self.render(key) else { return nil }
        images.setObject(
            ImageBox(value: rendered),
            forKey: key,
            cost: rendered.image.width * rendered.image.height * 4
        )
        return rendered
    }

    private static func render(_ key: CacheKey) -> RichReferenceChipImage? {
        guard key.style.displayScale > 0, key.style.proportions.height > 0 else {
            return nil
        }
        let renderer = ImageRenderer(
            content: RichReferenceChip(
                reference: key.reference,
                proportions: key.style.proportions
            )
                .environment(\.colorScheme, key.style.colorScheme)
                .environment(\.dynamicTypeSize, key.style.dynamicTypeSize)
                .environment(\.legibilityWeight, key.style.legibilityWeight)
        )
        renderer.scale = key.style.displayScale
        guard let image = renderer.cgImage else { return nil }
        return RichReferenceChipImage(
            image: image,
            size: CGSize(
                width: CGFloat(image.width) / key.style.displayScale,
                height: CGFloat(image.height) / key.style.displayScale
            )
        )
    }

    private final class ImageBox {
        let value: RichReferenceChipImage
        init(value: RichReferenceChipImage) { self.value = value }
    }

    /// `NSCache` keys are objects, so the value key rides in one.
    private final class CacheKey: NSObject {
        let reference: RichReferencePresentation
        let style: RichReferenceChipStyle

        init(reference: RichReferencePresentation, style: RichReferenceChipStyle) {
            self.reference = reference
            self.style = style
        }

        override var hash: Int {
            var hasher = Hasher()
            hasher.combine(reference)
            hasher.combine(style)
            return hasher.finalize()
        }

        override func isEqual(_ object: Any?) -> Bool {
            guard let other = object as? CacheKey else { return false }
            return reference == other.reference && style == other.style
        }
    }
}
