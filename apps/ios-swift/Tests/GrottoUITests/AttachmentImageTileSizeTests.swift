@testable import GrottoUI
import Testing

struct AttachmentImageTileSizeTests {
    @Test func fitsALandscapeImageToTheMaxWidth() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 4032, pixelHeight: 3024, maxDimension: 240)
        #expect(size.width == 240)
        #expect(size.height == 180)
    }

    @Test func fitsAPortraitImageToTheMaxHeight() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 3024, pixelHeight: 4032, maxDimension: 240)
        #expect(size.width == 180)
        #expect(size.height == 240)
    }

    @Test func fitsASquareImageToTheMaxDimensionOnBothAxes() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 1000, pixelHeight: 1000, maxDimension: 240)
        #expect(size.width == 240)
        #expect(size.height == 240)
    }

    @Test func fallsBackToThePlaceholderSizeForInvalidDimensions() {
        #expect(AttachmentImageTileSize.fitted(pixelWidth: 0, pixelHeight: 400) == AttachmentImageTileSize.placeholderSize)
        #expect(AttachmentImageTileSize.fitted(pixelWidth: 400, pixelHeight: 0) == AttachmentImageTileSize.placeholderSize)
    }
}
