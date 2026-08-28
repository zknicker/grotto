import SwiftUI

/// The portal card's box: how big it is in each mode, where it sits in the container, and what it
/// has to become for its collapse to land inside the composer's attachment tile.
struct ComposerPortalGeometry {
    let overlay: ComposerOverlay?
    let availableSize: CGSize
    /// The composer shell's top edge in the container's space, which the source menu sits on.
    let composerTop: CGFloat?

    /// The card's leading inset. The collapse measures from it, so it is geometry, not padding.
    static let leadingInset: CGFloat = 12
    private static let floorPadding: CGFloat = 8

    private var isSourceMenu: Bool { overlay == .sources }

    /// The media card sits nearly full-bleed, so its corners must nest concentrically inside the
    /// display's (~55pt) rounding: inner radius ≈ outer minus inset. The source menu floats
    /// mid-screen with no bezel relationship and keeps the ordinary card radius.
    var cornerRadius: CGFloat { isSourceMenu ? 30 : 44 }

    var width: CGFloat {
        isSourceMenu ? min(286, availableSize.width - 32) : availableSize.width - 24
    }

    var height: CGFloat {
        isSourceMenu ? 210 : min(520, max(390, availableSize.height * 0.58))
    }

    var size: CGSize { CGSize(width: width, height: height) }

    /// The source menu pops off the plus and stands clear of the composer; the media portals are
    /// full-bleed cards that sit on the container floor the way the reference does.
    var bottomPadding: CGFloat {
        guard isSourceMenu, let composerTop else { return Self.floorPadding }
        return Self.sourceMenuBottomPadding(
            composerTop: composerTop,
            containerHeight: availableSize.height,
            menuHeight: height
        )
    }

    var origin: CGPoint {
        CGPoint(x: Self.leadingInset, y: availableSize.height - bottomPadding - height)
    }

    /// Sits the menu on the composer's top edge, but never so high that a tall draft or a full
    /// attachment strip pushes the card off the top of the screen.
    static func sourceMenuBottomPadding(
        composerTop: CGFloat,
        containerHeight: CGFloat,
        menuHeight: CGFloat
    ) -> CGFloat {
        let aboveComposer = containerHeight - composerTop + floorPadding
        let highestAllowed = max(floorPadding, containerHeight - menuHeight - floorPadding)
        return min(max(floorPadding, aboveComposer), highestAllowed)
    }

    func collapseScale(landing: CGRect?) -> CGSize {
        guard let landing, width > 0, height > 0 else { return CGSize(width: 1, height: 1) }
        return CGSize(width: landing.width / width, height: landing.height / height)
    }

    func collapseOffset(landing: CGRect?) -> CGSize {
        guard let landing else { return .zero }
        return CGSize(width: landing.minX - origin.x, height: landing.minY - origin.y)
    }
}
