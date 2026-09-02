import CoreGraphics
@testable import GrottoUI
import Testing

struct AttachmentImageViewerDecodeTests {
    @Test func sizesTheDecodeToTheDisplaysLongestSideInPixels() {
        let size = AttachmentImageViewerDecode.pixelSize(
            screenSize: CGSize(width: 402, height: 874),
            scale: 3
        )
        #expect(size == 2622)
    }

    @Test func readsTheLongestSideWhateverTheOrientation() {
        let portrait = AttachmentImageViewerDecode.pixelSize(
            screenSize: CGSize(width: 402, height: 874),
            scale: 2
        )
        let landscape = AttachmentImageViewerDecode.pixelSize(
            screenSize: CGSize(width: 874, height: 402),
            scale: 2
        )
        #expect(portrait == landscape)
    }

    @Test func neverDecodesToNothingWhenTheScreenHasNotBeenReported() {
        let size = AttachmentImageViewerDecode.pixelSize(screenSize: .zero, scale: 0)
        #expect(size == AttachmentImageViewerDecode.minimumPixelSize)
    }

    @Test func capsTheDecodeSoOnePageCannotCostTheWholeBudget() {
        let size = AttachmentImageViewerDecode.pixelSize(
            screenSize: CGSize(width: 4000, height: 6000),
            scale: 3
        )
        #expect(size == AttachmentImageViewerDecode.maximumPixelSize)
    }
}
