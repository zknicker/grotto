import CoreGraphics
import Foundation

/// How the viewer's full-resolution decode is sized.
///
/// The tile decodes small on purpose; the viewer draws the same bytes across
/// the whole display and needs the pixels for it. One display's longest side is
/// the ceiling worth carrying: a larger decode cannot show more, and every
/// extra pixel is memory held for a page the reader may swipe straight past.
enum AttachmentImageViewerDecode {
    /// Guards the arithmetic against a screen size that has not been reported
    /// yet, so a first page never decodes to nothing.
    static let minimumPixelSize: CGFloat = 1024
    /// Ceiling for the tallest displays and any future scale factor.
    static let maximumPixelSize: CGFloat = 4096

    static func pixelSize(screenSize: CGSize, scale: CGFloat) -> CGFloat {
        let longestSide = max(screenSize.width, screenSize.height)
        let requested = (longestSide * max(1, scale)).rounded()
        return min(maximumPixelSize, max(minimumPixelSize, requested))
    }
}
