import SwiftUI

/// The chosen photo flying from the picker into the composer's attachment tile.
///
/// The reveal starts early on purpose: what lands in the composer should read as the photo, not as
/// a shrinking screenshot of the grid it came from.
///
/// `progress` is the animated value, not the frame: the destination is still settling while the
/// composer grows its attachment strip, and animating progress lets a moving target change where
/// the photo is going without restarting how it gets there.
struct MorphingAttachmentImage: View, @preconcurrency Animatable {
    let url: URL
    let sourceFrame: CGRect
    let destinationFrame: CGRect
    let sourceCornerRadius: CGFloat
    var progress: CGFloat

    static let revealStart: CGFloat = 0.35
    static let revealEnd: CGFloat = 0.75

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        let frame = interpolate(from: sourceFrame, to: destinationFrame, progress: progress)
        let cornerRadius = interpolate(from: sourceCornerRadius, to: 14, progress: progress)
        let reveal = Self.revealProgress(for: progress)

        LocalAttachmentImage(url: url)
            .frame(width: frame.width, height: frame.height)
            .clipShape(.rect(cornerRadius: cornerRadius))
            .position(x: frame.midX, y: frame.midY)
            .opacity(reveal)
            .blur(radius: 4 * (1 - reveal))
    }

    static func revealProgress(for progress: CGFloat) -> CGFloat {
        min(1, max(0, (progress - revealStart) / (revealEnd - revealStart)))
    }

    private func interpolate(from start: CGFloat, to end: CGFloat, progress: CGFloat) -> CGFloat {
        start + ((end - start) * progress)
    }

    private func interpolate(from start: CGRect, to end: CGRect, progress: CGFloat) -> CGRect {
        CGRect(
            x: interpolate(from: start.minX, to: end.minX, progress: progress),
            y: interpolate(from: start.minY, to: end.minY, progress: progress),
            width: interpolate(from: start.width, to: end.width, progress: progress),
            height: interpolate(from: start.height, to: end.height, progress: progress)
        )
    }
}
