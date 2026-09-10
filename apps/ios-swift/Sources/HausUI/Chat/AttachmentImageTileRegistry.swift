import SwiftUI
#if os(iOS)
import UIKit
#endif

/// Where the screen finds the tile a viewer should grow out of and fall back
/// into.
///
/// The zoom transition needs a live `UIView` for the source, and transcript
/// rows are hosted inside `UIHostingConfiguration` cells — a hierarchy the
/// screen cannot see into, and one SwiftUI's own `matchedTransitionSource`
/// cannot reach across either. Each tile therefore publishes its own view here
/// under its attachment id, and the screen's presenter reads it back. Entries
/// are weak, so a recycled or scrolled-away cell simply stops answering and the
/// transition falls back to a plain fade.
///
/// The screen owns one of these and hands it down beside the preview binding.
@MainActor
final class AttachmentImageTileRegistry {
    init() {}

    #if os(iOS)
    private var views: [String: WeakView] = [:]

    func view(for attachmentID: String) -> UIView? {
        guard let view = views[attachmentID]?.view else {
            views.removeValue(forKey: attachmentID)
            return nil
        }
        // A cell that left the window is off screen; the transition has nothing
        // to travel to and the system's fade is the honest answer. So is a
        // strip square scrolled out of its row: it is still in the window, just
        // clipped away, and a card growing out of a place nobody can see is
        // worse than no card growing at all.
        guard view.window != nil, Self.isVisible(view) else { return nil }
        return view
    }

    /// Whether any of the view is actually on screen, judged against every
    /// ancestor that clips — the strip's scroll view, the transcript's table,
    /// and the window itself.
    private static func isVisible(_ view: UIView) -> Bool {
        var visible = view.bounds
        var current = view
        while let parent = current.superview {
            visible = current.convert(visible, to: parent)
            if parent.clipsToBounds || parent is UIScrollView || parent is UIWindow {
                visible = visible.intersection(parent.bounds)
                if visible.isNull || visible.isEmpty { return false }
            }
            current = parent
        }
        return true
    }

    fileprivate func register(_ view: UIView, for attachmentID: String) {
        views[attachmentID] = WeakView(view: view)
    }

    fileprivate func unregister(_ view: UIView, for attachmentID: String) {
        guard views[attachmentID]?.view === view else { return }
        views.removeValue(forKey: attachmentID)
    }

    private struct WeakView {
        weak var view: UIView?
    }
    #endif
}

#if os(iOS)
/// The tile's inert stand-in in UIKit.
///
/// It draws nothing and takes no touches; it exists so the zoom transition has
/// a real view with the tile's exact frame and corner radius to travel from.
/// Same shape as `ComposerPortalSceneReader`: a representable whose only job is
/// to report a fact about the UIKit hierarchy the SwiftUI view sits in.
struct AttachmentImageTileAnchor: UIViewRepresentable {
    let attachmentID: String
    let registry: AttachmentImageTileRegistry

    func makeUIView(context: Context) -> AnchorView {
        AnchorView(attachmentID: attachmentID, registry: registry)
    }

    func updateUIView(_ view: AnchorView, context: Context) {
        view.rebind(attachmentID: attachmentID, registry: registry)
    }

    static func dismantleUIView(_ view: AnchorView, coordinator: Coordinator) {
        view.release()
    }

    @MainActor
    final class AnchorView: UIView {
        private var attachmentID: String
        private var registry: AttachmentImageTileRegistry

        init(attachmentID: String, registry: AttachmentImageTileRegistry) {
            self.attachmentID = attachmentID
            self.registry = registry
            super.init(frame: .zero)
            isUserInteractionEnabled = false
            backgroundColor = .clear
            // The transition reads the source's corners, so the anchor wears
            // the tile's clip rather than a square one; without it the card
            // would start as a rectangle inside a rounded tile.
            layer.cornerRadius = AttachmentImageTileSize.cornerRadius
            layer.cornerCurve = .continuous
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

        /// A recycled cell keeps its anchor view and changes the attachment
        /// under it, so the old id has to stop pointing here.
        func rebind(attachmentID: String, registry: AttachmentImageTileRegistry) {
            guard attachmentID != self.attachmentID || registry !== self.registry else { return }
            release()
            self.attachmentID = attachmentID
            self.registry = registry
            if window != nil { registry.register(self, for: attachmentID) }
        }

        func release() {
            registry.unregister(self, for: attachmentID)
        }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            if window == nil {
                release()
            } else {
                registry.register(self, for: attachmentID)
            }
        }
    }
}
#endif
