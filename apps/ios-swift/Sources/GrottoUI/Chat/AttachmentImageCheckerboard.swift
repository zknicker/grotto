#if os(iOS)
import SwiftUI
import UIKit

/// The full-bleed transparency grid behind a viewer page.
///
/// It runs edge to edge rather than only under the image: the grid is the
/// viewer's ground for a transparent image, and a grid that stopped at the
/// image's box would read as a second, floating card.
///
/// Drawn as one tiled pattern image rather than thousands of shapes. The page
/// travels under a finger during dismissal, so this repaints continuously —
/// a tiled `UIImage` is one draw call whatever the screen size, where a
/// per-square canvas is several thousand.
struct AttachmentImageCheckerboard: View {
    let tone: AttachmentCheckerboardTone

    static let square: CGFloat = 12

    var body: some View {
        Image(uiImage: AttachmentCheckerboardPattern.image(for: tone))
            .resizable(resizingMode: .tile)
            .accessibilityHidden(true)
    }
}

/// The two-by-two pattern tile, rendered once per tone and per screen scale.
@MainActor
private enum AttachmentCheckerboardPattern {
    private static var cache: [AttachmentCheckerboardTone: UIImage] = [:]

    static func image(for tone: AttachmentCheckerboardTone) -> UIImage {
        if let cached = cache[tone] { return cached }
        let side = AttachmentImageCheckerboard.square
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
        cache[tone] = image
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
