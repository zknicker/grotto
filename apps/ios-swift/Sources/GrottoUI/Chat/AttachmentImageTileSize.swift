import CoreGraphics

/// Pure sizing logic for inline image attachment tiles. Fits the source image's
/// pixel aspect ratio inside a square bound without upscaling past it.
enum AttachmentImageTileSize {
    static let maxDimension: CGFloat = 240
    static let placeholderSize = CGSize(width: 240, height: 160)

    static func fitted(
        pixelWidth: Int,
        pixelHeight: Int,
        maxDimension: CGFloat = maxDimension
    ) -> CGSize {
        guard pixelWidth > 0, pixelHeight > 0 else { return placeholderSize }
        let aspect = CGFloat(pixelWidth) / CGFloat(pixelHeight)
        if aspect >= 1 {
            return CGSize(width: maxDimension, height: (maxDimension / aspect).rounded())
        }
        return CGSize(width: (maxDimension * aspect).rounded(), height: maxDimension)
    }
}
