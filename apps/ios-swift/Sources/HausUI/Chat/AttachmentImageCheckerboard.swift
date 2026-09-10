#if os(iOS)
import SwiftUI
import UIKit

/// The transparency grid an image with real transparency sits on.
///
/// In the viewer it runs edge to edge rather than only under the image: the
/// grid is the viewer's ground there, and a grid that stopped at the image's
/// box would read as a second, floating card. In the transcript it does the
/// opposite job — it fills the tile's rounded rect, so a transparent PNG reads
/// as an object on a surface instead of floating loose on the Chat — and it
/// takes a finer grid, because the viewer's 12pt squares inside a 96pt
/// thumbnail would be four squares of wallpaper rather than a texture.
///
/// Drawn as one tiled pattern image rather than thousands of shapes. A viewer
/// page travels under a finger during dismissal, so this repaints continuously
/// — a tiled `UIImage` is one draw call whatever the screen size, where a
/// per-square canvas is several thousand.
struct AttachmentImageCheckerboard: View {
    let tone: AttachmentCheckerboardTone
    var square: CGFloat = AttachmentImageCheckerboard.square

    static let square: CGFloat = 12
    static let thumbnailSquare: CGFloat = 6

    var body: some View {
        Image(uiImage: AttachmentCheckerboardPattern.image(for: tone, square: square))
            .resizable(resizingMode: .tile)
            .accessibilityHidden(true)
    }
}

/// The two-by-two pattern tile, rendered once per tone, grid, and screen scale.
@MainActor
private enum AttachmentCheckerboardPattern {
    private struct Key: Hashable {
        let tone: AttachmentCheckerboardTone
        let square: CGFloat
    }

    private static var cache: [Key: UIImage] = [:]

    static func image(for tone: AttachmentCheckerboardTone, square side: CGFloat) -> UIImage {
        let key = Key(tone: tone, square: side)
        if let cached = cache[key] { return cached }
        let format = UIGraphicsImageRendererFormat.preferred()
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(
            size: CGSize(width: side * 2, height: side * 2),
            format: format
        )
        let (base, alternate) = colors(for: tone)
        let image = renderer.image { context in
            base.setFill()
            context.fill(CGRect(x: 0, y: 0, width: side * 2, height: side * 2))
            alternate.setFill()
            context.fill(CGRect(x: side, y: 0, width: side, height: side))
            context.fill(CGRect(x: 0, y: side, width: side, height: side))
        }
        cache[key] = image
        return image
    }

    /// Tuned as a pair, not as two independent greys: the step between the two
    /// squares is what reads as "grid", and it stays the same on both tones so
    /// neither one is busier than the other.
    private static func colors(for tone: AttachmentCheckerboardTone) -> (UIColor, UIColor) {
        switch tone {
        case .light:
            (UIColor(white: 0.90, alpha: 1), UIColor(white: 0.76, alpha: 1))
        case .dark:
            (UIColor(white: 0.26, alpha: 1), UIColor(white: 0.17, alpha: 1))
        }
    }
}
#endif
