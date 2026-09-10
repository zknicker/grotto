import CoreGraphics

/// How far, and to what, a viewer page zooms.
///
/// The arithmetic lives apart from the scroll view that applies it so the three
/// rules a reader actually feels — how far a page may go, where a double tap
/// lands, and when a page counts as zoomed — are readable and testable without
/// a running scroll view.
enum AttachmentImageZoom {
    /// Fit is `1`. Every page can reach this much whatever its shape.
    static let baseMaximumScale: CGFloat = 3
    /// Ceiling for an extreme aspect ratio, so a one-pixel-tall banner cannot
    /// ask for a thousandfold zoom.
    static let absoluteMaximumScale: CGFloat = 8
    /// A double tap opens at least this far, so the gesture always visibly
    /// does something even on an image that already fills the display.
    static let doubleTapMinimumScale: CGFloat = 2
    /// An animated zoom lands a hair off its target, and a page a hundredth
    /// above fit is still the fit as far as paging and dismissal care.
    static let zoomEpsilon: CGFloat = 0.01

    /// The image's box at fit — the frame the page draws at scale `1`.
    static func fittedSize(image: CGSize, in bounds: CGSize) -> CGSize {
        guard image.width > 0, image.height > 0, bounds.width > 0, bounds.height > 0 else {
            return bounds
        }
        let scale = min(bounds.width / image.width, bounds.height / image.height)
        return CGSize(width: image.width * scale, height: image.height * scale)
    }

    /// What it takes to cover the display from the fitted box. `1` for an image
    /// whose shape already matches the screen; large for a wide panorama.
    static func fillScale(fitted: CGSize, in bounds: CGSize) -> CGFloat {
        guard fitted.width > 0, fitted.height > 0 else { return 1 }
        return max(1, max(bounds.width / fitted.width, bounds.height / fitted.height))
    }

    /// A page always reaches `baseMaximumScale`, and one whose shape is far off
    /// the display's reaches at least far enough to fill it — a panorama fitted
    /// to the width is a sliver, and stopping at 3x would still leave it one.
    static func maximumScale(image: CGSize, in bounds: CGSize) -> CGFloat {
        let fitted = fittedSize(image: image, in: bounds)
        let fill = fillScale(fitted: fitted, in: bounds)
        return min(absoluteMaximumScale, max(baseMaximumScale, fill))
    }

    /// Double tap toggles: a zoomed page returns to fit, a fitted page opens to
    /// the scale that fills the display, never less than `doubleTapMinimumScale`
    /// and never past what the page allows.
    static func doubleTapScale(current: CGFloat, image: CGSize, in bounds: CGSize) -> CGFloat {
        let maximum = maximumScale(image: image, in: bounds)
        guard !isZoomed(current) else { return 1 }
        let fitted = fittedSize(image: image, in: bounds)
        let fill = fillScale(fitted: fitted, in: bounds)
        return min(maximum, max(doubleTapMinimumScale, fill))
    }

    /// The rect a scroll view should zoom to so `point` — in the zoomed view's
    /// own coordinates — stays under the finger.
    static func zoomRect(scale: CGFloat, around point: CGPoint, in bounds: CGSize) -> CGRect {
        guard scale > 0 else { return CGRect(origin: .zero, size: bounds) }
        let size = CGSize(width: bounds.width / scale, height: bounds.height / scale)
        return CGRect(
            x: point.x - (size.width / 2),
            y: point.y - (size.height / 2),
            width: size.width,
            height: size.height
        )
    }

    /// Keeps content smaller than the page centred rather than pinned to the
    /// top-left, on each axis independently: a wide image zoomed past the
    /// screen's width is still letterboxed vertically.
    static func centeringInset(content: CGFloat, bounds: CGFloat) -> CGFloat {
        max(0, (bounds - content) / 2)
    }

    static func isZoomed(_ scale: CGFloat) -> Bool {
        scale > 1 + zoomEpsilon
    }

    /// Whether a page has to lay out again from fit.
    ///
    /// The tile's bitmap and the full decode are the same picture at different
    /// pixel counts, so their fitted boxes differ by a rounding hair; treating
    /// that as a new box would drop the reader's zoom the moment the sharp
    /// decode landed. A genuinely different shape, or a resized page, moves the
    /// box by far more than a point.
    static func needsRelayout(from laidOut: CGSize, to fitted: CGSize) -> Bool {
        abs(laidOut.width - fitted.width) > 1 || abs(laidOut.height - fitted.height) > 1
    }
}

/// Which page, if any, is currently zoomed.
///
/// The viewer has one answer to give the zoom transition — may an interactive
/// dismissal begin — and several live pages that could each report a scale. A
/// neighbouring page settling at fit must not clear the zoom of the page in
/// hand, so a page can only release a zoom it claimed.
struct AttachmentImageZoomClaim: Equatable {
    private(set) var pageID: String?

    var isZoomed: Bool { pageID != nil }

    mutating func set(_ zoomed: Bool, for pageID: String) {
        if zoomed {
            self.pageID = pageID
        } else if self.pageID == pageID {
            self.pageID = nil
        }
    }
}
