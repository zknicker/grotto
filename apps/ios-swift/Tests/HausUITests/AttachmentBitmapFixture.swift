import CoreGraphics

/// A tiny opaque bitmap, for the caches and models that now carry the decode
/// itself rather than only a SwiftUI `Image` drawn from it.
enum AttachmentBitmapFixture {
    static func bitmap(width: Int = 4, height: Int = 4) -> CGImage {
        let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )
        guard let context, let image = context.makeImage() else {
            preconditionFailure("the fixture bitmap could not be drawn")
        }
        return image
    }
}
