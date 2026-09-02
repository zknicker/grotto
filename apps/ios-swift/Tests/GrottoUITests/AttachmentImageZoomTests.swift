import CoreGraphics
@testable import GrottoUI
import Testing

struct AttachmentImageZoomTests {
    private let screen = CGSize(width: 402, height: 874)

    @Test func fitsAnImageInsideThePageWithoutCropping() {
        let fitted = AttachmentImageZoom.fittedSize(
            image: CGSize(width: 4000, height: 2000),
            in: screen
        )
        #expect(fitted.width == 402)
        #expect(fitted.height == 201)
    }

    @Test func fitsToThePageWhenTheImageIsTallerThanItIsWide() {
        let fitted = AttachmentImageZoom.fittedSize(
            image: CGSize(width: 1000, height: 4000),
            in: screen
        )
        #expect(fitted.height == 874)
        #expect(abs(fitted.width - 218.5) < 0.01)
    }

    /// A page whose bounds or image have not been reported yet must not resolve
    /// to a zero box, which would leave the reader with nothing on screen.
    @Test func fallsBackToThePageWhenAnImageHasNoSize() {
        #expect(AttachmentImageZoom.fittedSize(image: .zero, in: screen) == screen)
        #expect(AttachmentImageZoom.fittedSize(image: screen, in: .zero) == .zero)
    }

    @Test func alwaysAllowsTheBaseZoomWhateverTheShape() {
        let square = AttachmentImageZoom.maximumScale(
            image: CGSize(width: 1000, height: 1000),
            in: screen
        )
        #expect(square == AttachmentImageZoom.baseMaximumScale)
    }

    /// A panorama fitted to the width is a sliver; stopping at the base scale
    /// would leave it one, so the page reaches at least far enough to fill.
    @Test func letsAPanoramaReachTheScaleThatFillsTheDisplay() {
        let panorama = AttachmentImageZoom.maximumScale(
            image: CGSize(width: 8000, height: 1000),
            in: screen
        )
        #expect(panorama > AttachmentImageZoom.baseMaximumScale)
        #expect(panorama <= AttachmentImageZoom.absoluteMaximumScale)
    }

    @Test func capsTheZoomOfAnExtremeAspectRatio() {
        let banner = AttachmentImageZoom.maximumScale(
            image: CGSize(width: 20000, height: 20),
            in: screen
        )
        #expect(banner == AttachmentImageZoom.absoluteMaximumScale)
    }

    /// An image already the shape of the display has nothing left to fill, so
    /// the gesture still has to do something visible.
    @Test func doubleTapOpensAFittedPageAndClosesAZoomedOne() {
        let image = CGSize(width: 804, height: 1748)
        let opened = AttachmentImageZoom.doubleTapScale(current: 1, image: image, in: screen)
        #expect(opened == AttachmentImageZoom.doubleTapMinimumScale)
        #expect(AttachmentImageZoom.doubleTapScale(current: opened, image: image, in: screen) == 1)
    }

    /// A letterboxed image's double tap goes to the scale that fills the page,
    /// which is what the gesture reads as on a wide photograph.
    @Test func doubleTapFillsTheDisplayForAWideImage() {
        let image = CGSize(width: 4000, height: 2000)
        let opened = AttachmentImageZoom.doubleTapScale(current: 1, image: image, in: screen)
        let fitted = AttachmentImageZoom.fittedSize(image: image, in: screen)
        #expect(abs(opened - (screen.height / fitted.height)) < 0.01)
    }

    @Test func doubleTapNeverPassesWhatThePageAllows() {
        let image = CGSize(width: 20000, height: 20)
        let opened = AttachmentImageZoom.doubleTapScale(current: 1, image: image, in: screen)
        #expect(opened == AttachmentImageZoom.maximumScale(image: image, in: screen))
    }

    @Test func zoomRectKeepsTheTappedPointUnderTheFinger() {
        let rect = AttachmentImageZoom.zoomRect(
            scale: 2,
            around: CGPoint(x: 100, y: 200),
            in: screen
        )
        #expect(rect.midX == 100)
        #expect(rect.midY == 200)
        #expect(rect.width == 201)
        #expect(rect.height == 437)
    }

    @Test func centersContentSmallerThanThePageAndPinsContentLargerThanIt() {
        #expect(AttachmentImageZoom.centeringInset(content: 200, bounds: 874) == 337)
        #expect(AttachmentImageZoom.centeringInset(content: 2000, bounds: 874) == 0)
    }

    /// The tile's bitmap and the full decode are the same picture at different
    /// pixel counts; laying out again for that rounding hair would drop the
    /// reader's zoom the moment the sharp decode landed.
    @Test func keepsThePageAsLaidOutWhenTheSharperDecodeLands() {
        let thumbnail = AttachmentImageZoom.fittedSize(
            image: CGSize(width: 480, height: 140),
            in: screen
        )
        let full = AttachmentImageZoom.fittedSize(
            image: CGSize(width: 2622, height: 764),
            in: screen
        )
        #expect(thumbnail != full)
        #expect(!AttachmentImageZoom.needsRelayout(from: thumbnail, to: full))
    }

    @Test func laysOutAgainForAGenuinelyDifferentBox() {
        #expect(
            AttachmentImageZoom.needsRelayout(
                from: CGSize(width: 402, height: 201),
                to: CGSize(width: 402, height: 874)
            )
        )
    }

    /// A scroll view lands a hair off after an animated zoom, and a page a
    /// hundredth above fit still has to page and dismiss like a fitted one.
    @Test func treatsAPageAHairAboveFitAsStillFitted() {
        #expect(!AttachmentImageZoom.isZoomed(1))
        #expect(!AttachmentImageZoom.isZoomed(1.0001))
        #expect(AttachmentImageZoom.isZoomed(1.5))
    }
}

struct AttachmentImageZoomClaimTests {
    @Test func aFittedViewerClaimsNoPage() {
        #expect(!AttachmentImageZoomClaim().isZoomed)
    }

    @Test func theZoomedPageIsTheOneThatClaimedIt() {
        var claim = AttachmentImageZoomClaim()
        claim.set(true, for: "page-a")
        #expect(claim.pageID == "page-a")
        claim.set(false, for: "page-a")
        #expect(!claim.isZoomed)
    }

    /// Both neighbours of the page in hand are live and lay out at fit, so a
    /// page must not be able to release a zoom it never claimed.
    @Test func aNeighbouringPageCannotReleaseAnotherPagesZoom() {
        var claim = AttachmentImageZoomClaim()
        claim.set(true, for: "page-a")
        claim.set(false, for: "page-b")
        #expect(claim.pageID == "page-a")
    }
}
