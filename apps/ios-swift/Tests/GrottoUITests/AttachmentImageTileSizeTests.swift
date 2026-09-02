import CoreGraphics
@testable import GrottoUI
import Testing

struct AttachmentImageTileSizeTests {
    /// Every case is stated at 3x, the scale the phones this ships to run at.
    private static let scale: CGFloat = 3

    @Test func fitsALandscapePhotographToTheMaxWidthAtTheMaxHeight() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 4032, pixelHeight: 3024, scale: Self.scale)
        #expect(size.width == AttachmentImageTileSize.maxWidth)
        #expect(size.height == AttachmentImageTileSize.maxHeight)
    }

    @Test func keepsAPortraitPhotographAtTheMaxHeight() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 3024, pixelHeight: 4032, scale: Self.scale)
        #expect(size.width == 135)
        #expect(size.height == AttachmentImageTileSize.maxHeight)
    }

    /// The change Zach asked for: a 256-pixel icon is 85pt on a 3x display, so
    /// it stops being drawn 180pt tall.
    @Test func doesNotEnlargeAnImageSmallerThanTheBox() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 256, pixelHeight: 256, scale: Self.scale)
        #expect(size.width == AttachmentImageTileSize.minSide)
        #expect(size.height == AttachmentImageTileSize.minSide)
    }

    @Test func drawsAMidSizedImageAtExactlyItsNativePointSize() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 600, pixelHeight: 300, scale: Self.scale)
        #expect(size.width == 200)
        #expect(size.height == 100)
    }

    /// The floor is a tap target, and it is the only case where the tile still
    /// enlarges a picture.
    @Test func floorsATinyIconAtTheMinimumSide() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 48, pixelHeight: 48, scale: Self.scale)
        #expect(size.width == AttachmentImageTileSize.minSide)
        #expect(size.height == AttachmentImageTileSize.minSide)
    }

    @Test func fillsTheBoxExactlyAtTheBoxsOwnPixelSize() {
        let size = AttachmentImageTileSize.fitted(pixelWidth: 540, pixelHeight: 540, scale: Self.scale)
        #expect(size.width == AttachmentImageTileSize.maxHeight)
        #expect(size.height == AttachmentImageTileSize.maxHeight)
    }

    /// A panorama keeps a readable band rather than fitting to a 24pt sliver;
    /// the bitmap fill-crops inside the box.
    @Test func clampsExtremeAspectRatiosInsideTheBox() {
        let panorama = AttachmentImageTileSize.fitted(pixelWidth: 10_000, pixelHeight: 1_000, scale: Self.scale)
        #expect(panorama.width == AttachmentImageTileSize.maxWidth)
        #expect(panorama.height == AttachmentImageTileSize.maxHeight)
        let sliver = AttachmentImageTileSize.fitted(pixelWidth: 1_000, pixelHeight: 10_000, scale: Self.scale)
        #expect(sliver.width == AttachmentImageTileSize.minSide)
        #expect(sliver.height == AttachmentImageTileSize.maxHeight)
    }

    @Test func neverLeavesTheBoxForAnyAspectRatio() {
        let dimensions = [
            (1, 1), (100, 100), (4032, 3024), (3024, 4032), (1920, 1080),
            (1080, 1920), (10_000, 100), (100, 10_000), (7, 5), (5, 7),
        ]
        for (width, height) in dimensions {
            let size = AttachmentImageTileSize.fitted(
                pixelWidth: width,
                pixelHeight: height,
                scale: Self.scale
            )
            #expect(size.width >= AttachmentImageTileSize.minSide)
            #expect(size.height >= AttachmentImageTileSize.minSide)
            #expect(size.width <= AttachmentImageTileSize.maxWidth)
            #expect(size.height <= AttachmentImageTileSize.maxHeight)
        }
    }

    /// The same picture is smaller in points on a denser display, which is what
    /// "native size" means.
    @Test func scalesTheNativeSizeWithTheDisplay() {
        let dense = AttachmentImageTileSize.fitted(pixelWidth: 300, pixelHeight: 300, scale: 3)
        let sparse = AttachmentImageTileSize.fitted(pixelWidth: 300, pixelHeight: 300, scale: 2)
        #expect(dense.height == 100)
        #expect(sparse.height == 150)
    }

    @Test func fallsBackToThePlaceholderSizeForInvalidInput() {
        #expect(
            AttachmentImageTileSize.fitted(pixelWidth: 0, pixelHeight: 400, scale: 3)
                == AttachmentImageTileSize.placeholderSize
        )
        #expect(
            AttachmentImageTileSize.fitted(pixelWidth: 400, pixelHeight: 0, scale: 3)
                == AttachmentImageTileSize.placeholderSize
        )
        #expect(
            AttachmentImageTileSize.fitted(pixelWidth: 400, pixelHeight: 400, scale: 0)
                == AttachmentImageTileSize.placeholderSize
        )
    }
}

struct AttachmentImageStripSizeTests {
    /// The Chat column on a 402pt iPhone: 32pt of cell margins, a 38pt avatar,
    /// and the 11pt gutter beside it.
    private static let chatColumn: CGFloat = 321

    @Test func fitsThreeSquaresAcrossTheMessageColumn() {
        let side = AttachmentImageStripSize.square(columnWidth: Self.chatColumn)
        let gaps = AttachmentImageStripSize.gap * 2
        #expect(side * 3 + gaps <= Self.chatColumn)
        #expect((side + 1) * 3 + gaps > Self.chatColumn)
    }

    @Test func staysWithinTheSquareBoundsOnAnyColumn() {
        for column in stride(from: CGFloat(140), through: 900, by: 20) {
            let side = AttachmentImageStripSize.square(columnWidth: column)
            #expect(side >= AttachmentImageStripSize.minSquare)
            #expect(side <= AttachmentImageStripSize.maxSquare)
        }
    }

    @Test func floorsANarrowColumnAtATapTarget() {
        #expect(AttachmentImageStripSize.square(columnWidth: 200) == AttachmentImageStripSize.minSquare)
    }

    @Test func capsAWideColumnSoThumbnailsDoNotBecomeHeroes() {
        #expect(AttachmentImageStripSize.square(columnWidth: 900) == AttachmentImageStripSize.maxSquare)
    }

    /// The first frame, before the strip has measured its column, is drawn at
    /// the default — and the default is what a current iPhone measures to.
    @Test func usesTheDefaultSquareBeforeTheColumnIsMeasured() {
        #expect(AttachmentImageStripSize.square(columnWidth: 0) == AttachmentImageStripSize.defaultSquare)
        let measured = AttachmentImageStripSize.square(columnWidth: Self.chatColumn)
        #expect(abs(measured - AttachmentImageStripSize.defaultSquare) <= 2)
    }
}
