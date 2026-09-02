import CoreGraphics
@testable import GrottoUI
import Testing

struct AttachmentImageBackdropTests {
    @Test func putsAnOpaquePhotographOnBlack() throws {
        let image = try bitmap { context in
            context.setFillColor(gray: 0.45, alpha: 1)
            context.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
        }
        #expect(AttachmentImageBackdrop.classify(image) == .opaque)
    }

    /// The case that makes a pixel scan necessary: PNG encoders hand out an
    /// alpha channel whether or not the artwork uses it, so the channel's
    /// presence proves nothing.
    @Test func treatsAnUnusedAlphaChannelAsOpaque() throws {
        let image = try bitmap { context in
            context.setFillColor(red: 0.2, green: 0.6, blue: 0.9, alpha: 1)
            context.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
            context.setFillColor(red: 1, green: 1, blue: 1, alpha: 1)
            context.fill(CGRect(x: 8, y: 8, width: 20, height: 20))
        }
        #expect(image.alphaInfo != .none)
        #expect(AttachmentImageBackdrop.classify(image) == .opaque)
    }

    @Test func givesLightArtworkTheDarkGrid() throws {
        let image = try bitmap { context in
            context.setFillColor(gray: 0.95, alpha: 1)
            context.fill(CGRect(x: 0, y: 0, width: 32, height: 64))
        }
        #expect(AttachmentImageBackdrop.classify(image) == .checkerboard(.dark))
    }

    @Test func givesDarkArtworkTheLightGrid() throws {
        let image = try bitmap { context in
            context.setFillColor(gray: 0.08, alpha: 1)
            context.fill(CGRect(x: 0, y: 0, width: 32, height: 64))
        }
        #expect(AttachmentImageBackdrop.classify(image) == .checkerboard(.light))
    }

    /// A translucent white logo arrives from a premultiplied buffer looking
    /// almost black. Reading it as dark artwork would hand it the pale grid it
    /// disappears into.
    @Test func judgesTranslucentArtworkByItsOwnColourNotItsCoverage() throws {
        let image = try bitmap { context in
            context.setFillColor(gray: 1, alpha: 0.2)
            context.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
        }
        #expect(AttachmentImageBackdrop.classify(image) == .checkerboard(.dark))
    }

    /// Fully transparent pixels carry no colour, so an icon's empty margin must
    /// not drag the artwork's tone toward black.
    @Test func ignoresFullyTransparentPixelsWhenJudgingTone() throws {
        let mostlyEmpty = try bitmap { context in
            context.setFillColor(gray: 0.95, alpha: 1)
            context.fill(CGRect(x: 24, y: 24, width: 16, height: 16))
        }
        #expect(AttachmentImageBackdrop.classify(mostlyEmpty) == .checkerboard(.dark))
    }

    @Test func opaqueSamplesNeverGetAGridWhateverTheirTone() {
        for luminance in [0.0, 0.25, 0.5, 0.75, 1.0] {
            let sample = AttachmentImageBackdrop.Sample(
                hasTransparency: false,
                meanLuminance: luminance
            )
            #expect(AttachmentImageBackdrop.backdrop(for: sample) == .opaque)
        }
    }

    @Test func splitsTheGridToneAtTheLuminanceThreshold() {
        let threshold = AttachmentImageBackdrop.lightArtworkLuminance
        let lighter = AttachmentImageBackdrop.Sample(
            hasTransparency: true,
            meanLuminance: threshold + 0.01
        )
        let darker = AttachmentImageBackdrop.Sample(
            hasTransparency: true,
            meanLuminance: threshold - 0.01
        )
        #expect(AttachmentImageBackdrop.backdrop(for: lighter) == .checkerboard(.dark))
        #expect(AttachmentImageBackdrop.backdrop(for: darker) == .checkerboard(.light))
    }

    private func bitmap(
        width: Int = 64,
        height: Int = 64,
        draw: (CGContext) -> Void
    ) throws -> CGImage {
        let context = try #require(
            CGContext(
                data: nil,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            )
        )
        draw(context)
        return try #require(context.makeImage())
    }
}
