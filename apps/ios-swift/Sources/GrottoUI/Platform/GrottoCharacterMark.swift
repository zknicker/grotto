import SwiftUI

/// Grotto's character on its own — the blob silhouette with live, blinking
/// eyes — for loading and identity moments where the full icon tile is too
/// heavy. He keeps his app-icon colors in every color scheme: the white blob
/// with black, white-highlighted eyes, so he needs the icon's blue ground (or
/// any dark surface) behind him; see `GrottoBrandColors.iconGradient`.
///
/// Geometry mirrors the web mark (`apps/website/src/components/grotto-logo.tsx`):
/// the `GrottoMark` blob viewBox with the eyes layer at
/// `translate(184.35 229.79) scale(1.1416)`. Motion mirrors
/// `grotto-logo.css`: one 5.6s cycle with a blink at the start, a gentle
/// float, and a double blink halfway through.
public struct GrottoCharacterMark: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init() {}

    public var body: some View {
        Group {
            if reduceMotion {
                character(motion: CharacterMotion())
            } else {
                KeyframeAnimator(initialValue: CharacterMotion(), repeating: true) { motion in
                    character(motion: motion)
                } keyframes: { _ in
                    KeyframeTrack(\CharacterMotion.eyeScale) {
                        CubicKeyframe(0.08, duration: 0.084)
                        CubicKeyframe(1, duration: 0.084)
                        LinearKeyframe(1, duration: 2.856)
                        CubicKeyframe(0.08, duration: 0.084)
                        CubicKeyframe(0.55, duration: 0.084)
                        CubicKeyframe(0.08, duration: 0.084)
                        CubicKeyframe(1, duration: 0.084)
                        LinearKeyframe(1, duration: 2.24)
                    }
                    KeyframeTrack(\CharacterMotion.lift) {
                        CubicKeyframe(-1, duration: 2.8)
                        CubicKeyframe(0, duration: 2.8)
                    }
                }
            }
        }
        .aspectRatio(Self.artSize, contentMode: .fit)
        .accessibilityHidden(true)
    }

    private func character(motion: CharacterMotion) -> some View {
        GeometryReader { proxy in
            let scale = min(
                proxy.size.width / Self.artSize.width,
                proxy.size.height / Self.artSize.height
            )
            let drawn = CGSize(
                width: Self.artSize.width * scale,
                height: Self.artSize.height * scale
            )
            let origin = CGPoint(
                x: (proxy.size.width - drawn.width) / 2,
                y: (proxy.size.height - drawn.height) / 2
            )

            ZStack {
                Image("GrottoMark", bundle: .module)
                    .renderingMode(.template)
                    .resizable()
                    .foregroundStyle(GrottoBrandColors.iconBlob)
                    .opacity(GrottoBrandColors.iconBlobOpacity)
                    .frame(width: drawn.width, height: drawn.height)
                    .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
                ForEach(Self.eyeCenters, id: \.x) { center in
                    eye(scale: scale, eyeScale: motion.eyeScale)
                        .position(
                            x: origin.x + center.x * scale,
                            y: origin.y + center.y * scale
                        )
                }
            }
            .offset(y: motion.lift * drawn.height * Self.liftFraction)
        }
    }

    private func eye(scale: CGFloat, eyeScale: CGFloat) -> some View {
        ZStack {
            Capsule()
                .fill(GrottoBrandColors.iconEye)
                .frame(width: Self.eyeSize.width * scale, height: Self.eyeSize.height * scale)
            Capsule()
                .fill(GrottoBrandColors.iconBlob)
                .frame(
                    width: Self.highlightSize.width * scale,
                    height: Self.highlightSize.height * scale
                )
                .offset(
                    x: Self.highlightOffset.x * scale,
                    y: Self.highlightOffset.y * scale
                )
        }
        .scaleEffect(x: 1, y: eyeScale)
    }

    /// `GrottoMark.svg` viewBox.
    private static let artSize = CGSize(width: 715.9358, height: 708.3793)
    /// Eyes layer scale relative to the blob viewBox, from the web glyph.
    private static let eyesScale: CGFloat = 1.1416
    /// One eye is a 105.46 × 196.45 capsule in eye-layer units; the pair sits
    /// at (184.35, 229.79) with the second eye offset x by 178.93.
    private static let eyeSize = CGSize(width: 105.46 * eyesScale, height: 196.45 * eyesScale)
    private static let eyeCenters: [CGPoint] = {
        let y = 229.79 + eyeSize.height / 2
        let first = 184.35 + eyeSize.width / 2
        return [
            CGPoint(x: first, y: y),
            CGPoint(x: first + 178.93 * eyesScale, y: y),
        ]
    }()
    /// The eye shine, relative to the eye's center, from the icon artwork.
    private static let highlightSize = CGSize(width: 37.22 * eyesScale, height: 56.79 * eyesScale)
    private static let highlightOffset = CGPoint(
        x: (43.25 + 37.22 / 2 - 105.46 / 2) * eyesScale,
        y: (28.51 + 56.79 / 2 - 196.45 / 2) * eyesScale
    )
    /// Float amplitude as a fraction of the drawn height (~8pt at 96pt wide).
    private static let liftFraction: CGFloat = 0.08
}

private struct CharacterMotion {
    /// Vertical eye scale: 1 open, near 0 mid-blink.
    var eyeScale: CGFloat = 1
    /// Normalized float phase, 0 at rest to -1 at the top of the drift.
    var lift: CGFloat = 0
}

#Preview {
    GrottoCharacterMark()
        .frame(width: 96)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(GrottoBrandColors.iconGradient)
}
