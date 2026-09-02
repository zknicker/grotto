import CoreGraphics

/// Pure sizing logic for inline image attachment tiles.
///
/// Every tile is exactly `tileHeight` tall — the placeholder and the decoded
/// image share the same height for every aspect ratio, so a row never changes
/// height when a decode lands and the timeline never jumps. Width tracks the
/// source aspect ratio between `minWidth` and `maxDimension`; when the width
/// clamps, the bitmap fill-crops inside the box instead of resizing it.
enum AttachmentImageTileSize {
    static let maxDimension: CGFloat = 240
    static let tileHeight: CGFloat = 180
    static let minWidth: CGFloat = 96
    static let placeholderSize = CGSize(width: maxDimension, height: tileHeight)
    /// The tile's clip. The viewer's zoom source anchor wears the same radius,
    /// so the card's corners start exactly where the tile's end.
    static let cornerRadius: CGFloat = 14

    static func fitted(
        pixelWidth: Int,
        pixelHeight: Int,
        maxDimension: CGFloat = maxDimension
    ) -> CGSize {
        guard pixelWidth > 0, pixelHeight > 0 else { return placeholderSize }
        let aspect = CGFloat(pixelWidth) / CGFloat(pixelHeight)
        let width = min(maxDimension, max(minWidth, (tileHeight * aspect).rounded()))
        return CGSize(width: width, height: tileHeight)
    }
}
