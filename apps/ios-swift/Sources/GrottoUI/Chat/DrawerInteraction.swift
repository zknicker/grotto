import CoreGraphics
import Foundation

/// The finger-tracking math behind the sidebar drawer.
///
/// The drawer follows the finger one to one inside its travel, resists past
/// either end, and settles on the side the release actually implies. Keeping
/// this separate from the view keeps the feel testable.
enum DrawerInteraction {
    /// Release speed, in points per second, that decides the drawer on its own.
    static let flickVelocity: CGFloat = 300
    /// Fraction of travel a slow release must pass to open.
    static let openThreshold: CGFloat = 0.5

    /// Visible canvas offset for an in-progress drag.
    ///
    /// Travel stops at both ends rather than stretching: nothing sits behind
    /// the canvas past either edge, so an overdrag would only expose the app
    /// background.
    static func offset(isOpen: Bool, translation: CGFloat, width: CGFloat) -> CGFloat {
        guard width > 0 else { return 0 }
        return min(width, max(0, (isOpen ? width : 0) + translation))
    }

    /// Whether the drawer settles open after a release.
    static func settlesOpen(offset: CGFloat, velocity: CGFloat, width: CGFloat) -> Bool {
        guard width > 0 else { return false }
        if velocity > flickVelocity { return true }
        if velocity < -flickVelocity { return false }
        return offset > width * openThreshold
    }

    /// Gesture velocity expressed in the spring's normalized units.
    ///
    /// SwiftUI seeds a spring with velocity relative to the remaining change,
    /// so a fast flick over a short remaining distance stays fast.
    static func settleVelocity(velocity: CGFloat, offset: CGFloat, target: CGFloat) -> Double {
        let remaining = target - offset
        guard abs(remaining) > 0.5 else { return 0 }
        return Double(min(max(velocity / remaining, -25), 25))
    }

    /// Whether a drag starting in this state may move the drawer at all.
    static func accepts(velocity: CGPoint, isOpen: Bool) -> Bool {
        guard abs(velocity.x) > abs(velocity.y) else { return false }
        return isOpen ? true : velocity.x > 0
    }
}
