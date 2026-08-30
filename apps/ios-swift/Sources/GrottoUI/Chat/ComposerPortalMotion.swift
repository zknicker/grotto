import SwiftUI

/// How the attachment portal's menu enters, leaves, and answers a finger on it.
enum ComposerPortalMotion {
    /// The menu pops out of the plus the way a context menu pops out of its control.
    static let open: Animation = .spring(response: 0.30, dampingFraction: 0.78)
    /// Leaving is flatter and quicker than arriving: a dismissal should not linger.
    static let close: Animation = .easeOut(duration: 0.16)
    /// The card returning to rest after the finger lets go.
    static let rubberBandRelease: Animation = .spring(response: 0.32, dampingFraction: 0.7)
}

/// UIScrollView's rubber-band curve, `f(x) = (x·d·c) / (d + c·x)`, so dragging the open menu moves
/// it toward the finger with the resistance every other pulled surface on the platform has.
///
/// The stretch is deliberately below the eye's threshold for a shape change: it has to read as the
/// card resisting, never as the card deforming.
enum ComposerPortalRubberBand {
    /// Slope at the origin: how closely the card tracks the first point of travel.
    static let coefficient: CGFloat = 0.55
    /// The asymptote the offset approaches however far the finger goes.
    static let limit: CGFloat = 10
    /// Denominators for the stretch along the pulled axis and the squash across it.
    private static let stretchDivisor: CGFloat = 900
    private static let squashDivisor: CGFloat = 1800

    /// Per-axis, sign-preserving: a diagonal drag pulls both axes on their own curve.
    static func offset(for translation: CGSize) -> CGSize {
        CGSize(
            width: offset(for: translation.width),
            height: offset(for: translation.height)
        )
    }

    static func offset(for translation: CGFloat) -> CGFloat {
        let distance = abs(translation)
        let banded = (distance * limit * coefficient) / (limit + (coefficient * distance))
        return translation < 0 ? -banded : banded
    }

    /// Takes the banded offset, not the raw translation, so the stretch is bounded by `limit` too.
    static func stretch(for offset: CGSize) -> CGSize {
        let horizontal = abs(offset.width)
        let vertical = abs(offset.height)
        return CGSize(
            width: 1 + (horizontal / stretchDivisor) - (vertical / squashDivisor),
            height: 1 + (vertical / stretchDivisor) - (horizontal / squashDivisor)
        )
    }
}

extension View {
    /// Lets a finger drag the card a little way toward it and spring it back on release.
    func composerPortalPull(isEnabled: Bool) -> some View {
        modifier(ComposerPortalPullModifier(isEnabled: isEnabled))
    }
}

private struct ComposerPortalPullModifier: ViewModifier {
    let isEnabled: Bool

    @State private var pull: CGSize = .zero

    func body(content: Content) -> some View {
        content
            .scaleEffect(ComposerPortalRubberBand.stretch(for: pull), anchor: .center)
            .offset(x: pull.width, y: pull.height)
            // `.subviews` rather than `.none`, so a disabled pull still leaves the rows tappable.
            .simultaneousGesture(gesture, including: isEnabled ? .all : .subviews)
            .onChange(of: isEnabled) { _, enabled in
                guard !enabled else { return }
                withTransaction(Transaction(animation: nil)) { pull = .zero }
            }
    }

    private var gesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                // The card has to sit where the finger is now, not spring toward it.
                withTransaction(Transaction(animation: nil)) {
                    pull = ComposerPortalRubberBand.offset(for: value.translation)
                }
            }
            .onEnded { _ in
                withAnimation(ComposerPortalMotion.rubberBandRelease) { pull = .zero }
            }
    }
}
