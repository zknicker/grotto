import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

/// One horizontal drag of the chat canvas.
enum DrawerPan {
    case changed(translation: CGFloat)
    case ended(translation: CGFloat, velocity: CGFloat)
}

extension View {
    /// Attaches the drawer drag to a canvas.
    ///
    /// The drag starts anywhere on the canvas the moment the finger moves
    /// horizontally, so the canvas follows the finger instead of waiting for an
    /// edge swipe to complete.
    @ViewBuilder
    func drawerPan(
        isOpen: Bool,
        onPan: @escaping (DrawerPan) -> Void
    ) -> some View {
        #if os(iOS)
        gesture(DrawerPanGesture(isOpen: isOpen, onPan: onPan))
        #else
        self
        #endif
    }
}

#if os(iOS)
private struct DrawerPanGesture: UIGestureRecognizerRepresentable {
    let isOpen: Bool
    let onPan: (DrawerPan) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator {
        Coordinator(isOpen: isOpen)
    }

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let recognizer = UIPanGestureRecognizer()
        recognizer.delegate = context.coordinator
        return recognizer
    }

    func updateUIGestureRecognizer(_ recognizer: UIPanGestureRecognizer, context: Context) {
        context.coordinator.isOpen = isOpen
    }

    func handleUIGestureRecognizerAction(_ recognizer: UIPanGestureRecognizer, context: Context) {
        let view = recognizer.view
        let translation = recognizer.translation(in: view).x

        switch recognizer.state {
        case .began, .changed:
            onPan(.changed(translation: translation))
        case .ended:
            onPan(.ended(translation: translation, velocity: recognizer.velocity(in: view).x))
        case .cancelled, .failed:
            onPan(.ended(translation: translation, velocity: 0))
        default:
            break
        }
    }

    @MainActor
    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var isOpen: Bool

        init(isOpen: Bool) {
            self.isOpen = isOpen
        }

        /// Claims only drags that start out horizontal and can move the drawer.
        func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            guard let pan = gestureRecognizer as? UIPanGestureRecognizer else { return false }
            return DrawerInteraction.accepts(velocity: pan.velocity(in: pan.view), isOpen: isOpen)
        }

        /// Lets the timeline keep tracking until this drag actually begins.
        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
        ) -> Bool {
            true
        }

        /// Leaves horizontally scrollable content, such as staged attachments,
        /// alone, and makes every enclosing scroll view wait on this drag.
        ///
        /// The requirement is what locks the axis: a vertical drag fails this
        /// recognizer immediately and scrolling proceeds, while a horizontal one
        /// begins and the scroll view never starts, so later vertical movement
        /// in the same drag cannot scroll the timeline. Re-applying it on every
        /// touch keeps it attached to whichever scroll view SwiftUI currently
        /// has mounted.
        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldReceive touch: UITouch
        ) -> Bool {
            var candidate = touch.view
            var enclosing: [UIScrollView] = []
            while let view = candidate {
                if let scrollView = view as? UIScrollView {
                    if scrollView.contentSize.width > scrollView.bounds.width + 1 {
                        return false
                    }
                    enclosing.append(scrollView)
                }
                candidate = view.superview
            }
            for scrollView in enclosing {
                scrollView.panGestureRecognizer.require(toFail: gestureRecognizer)
            }
            return true
        }
    }
}
#endif
