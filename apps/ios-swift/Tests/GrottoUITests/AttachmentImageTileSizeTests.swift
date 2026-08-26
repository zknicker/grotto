@testable import GrottoUI
import Testing

struct AttachmentImageTileSizeTests {
    @Test func fitsALandscapeImageToTheMaxWidthAtTheFixedTileHeight() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 4032, pixelHeight: 3024, maxDimension: 240)
        #expect(size.width == 240)
        #expect(size.height == AttachmentImageTileSize.tileHeight)
    }

    @Test func keepsAPortraitImageAtTheFixedTileHeight() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 3024, pixelHeight: 4032, maxDimension: 240)
        #expect(size.width == 135)
        #expect(size.height == AttachmentImageTileSize.tileHeight)
    }

    @Test func rendersASquareImageAsATileHeightSquare() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 1000, pixelHeight: 1000, maxDimension: 240)
        #expect(size.width == AttachmentImageTileSize.tileHeight)
        #expect(size.height == AttachmentImageTileSize.tileHeight)
    }

    @Test func clampsExtremeAspectRatiosInsideTheWidthBounds() {
        let panorama = AttachmentImageTileSize.fitted(pixelWidth: 10_000, pixelHeight: 1000)
        #expect(panorama.width == AttachmentImageTileSize.maxDimension)
        let sliver = AttachmentImageTileSize.fitted(pixelWidth: 1000, pixelHeight: 10_000)
        #expect(sliver.width == AttachmentImageTileSize.minWidth)
    }

    /// The row-stability invariant: whatever lands after the placeholder must
    /// stand exactly as tall as the placeholder did, for every aspect ratio.
    @Test func placeholderHeightMatchesTheFinalHeightForEveryAspectRatio() {
        let dimensions = [
            (1, 1), (100, 100), (4032, 3024), (3024, 4032), (1920, 1080),
            (1080, 1920), (10_000, 100), (100, 10_000), (7, 5), (5, 7),
        ]
        for (width, height) in dimensions {
            let size = AttachmentImageTileSize.fitted(pixelWidth: width, pixelHeight: height)
            #expect(size.height == AttachmentImageTileSize.placeholderSize.height)
            #expect(size.height == AttachmentImageTileSize.tileHeight)
        }
    }

    @Test func fallsBackToThePlaceholderSizeForInvalidDimensions() {
        #expect(AttachmentImageTileSize.fitted(pixelWidth: 0, pixelHeight: 400) == AttachmentImageTileSize.placeholderSize)
        #expect(AttachmentImageTileSize.fitted(pixelWidth: 400, pixelHeight: 0) == AttachmentImageTileSize.placeholderSize)
    }
}
