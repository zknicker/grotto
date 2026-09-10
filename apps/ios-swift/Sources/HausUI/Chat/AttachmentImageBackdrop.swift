import CoreGraphics

/// The ground an image sits on in the attachment viewer.
///
/// A photograph fills its frame and wants nothing behind it, so it sits on
/// black. An image with real transparency has to show *where* it is
/// transparent, which is what the editing-tool checkerboard has always meant.
/// The grid's tone then has to contrast with the artwork rather than with the
/// app: a dark logo disappears into a dark grid, and a light one disappears
/// into a light grid, so the tone is picked from the image's own luminance.
enum AttachmentImageBackdrop: Equatable, Sendable {
    case opaque
    case checkerboard(AttachmentCheckerboardTone)
}

enum AttachmentCheckerboardTone: Equatable, Sendable {
    /// The pale grid, for artwork that is mostly dark.
    case light
    /// The deep grid, for artwork that is mostly light.
    case dark
}

extension AttachmentImageBackdrop {
    /// What a scan of an image's pixels reports, separated from the decision it
    /// feeds so the rule is readable and testable on its own.
    struct Sample: Equatable, Sendable {
        let hasTransparency: Bool
        /// Mean luminance of the pixels that actually carry colour, `0...1`.
        /// Fully transparent pixels contribute nothing — an icon's empty
        /// margin says nothing about how light the icon is.
        let meanLuminance: Double
    }

    /// Resampling can shave a hair off a fully opaque edge, so "transparent"
    /// means visibly transparent rather than mathematically below full alpha.
    static let opaqueAlphaFloor = 250.0 / 255.0

    /// Above this the artwork reads as light and takes the deep grid.
    static let lightArtworkLuminance = 0.5

    static func backdrop(for sample: Sample) -> AttachmentImageBackdrop {
        guard sample.hasTransparency else { return .opaque }
        return .checkerboard(sample.meanLuminance > lightArtworkLuminance ? .dark : .light)
    }

    static func classify(_ image: CGImage) -> AttachmentImageBackdrop {
        backdrop(for: sample(image))
    }

    /// Runs off the main actor. Classification draws and scans a bitmap, and
    /// the callers all sit next to a decode that is already off the main actor.
    static func classified(_ bitmap: DecodedAttachmentBitmap) async -> AttachmentImageBackdrop {
        classify(bitmap.cgImage)
    }

    /// Scans a downsampled copy rather than the source bitmap.
    ///
    /// An alpha channel is not evidence of transparency — PNG encoders emit one
    /// for images that never use it — so the answer has to come from the pixels.
    /// Reading every pixel of a full-resolution photograph to learn that costs
    /// far more than it is worth; a fixed small grid answers both questions
    /// (any transparency, and the overall tone) at a constant, negligible cost.
    static func sample(_ image: CGImage, gridSize: Int = 32) -> Sample {
        guard gridSize > 0 else { return Sample(hasTransparency: false, meanLuminance: 0) }
        let bytesPerRow = gridSize * 4
        var pixels = [UInt8](repeating: 0, count: bytesPerRow * gridSize)
        let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let base = buffer.baseAddress,
                  let context = CGContext(
                      data: base,
                      width: gridSize,
                      height: gridSize,
                      bitsPerComponent: 8,
                      bytesPerRow: bytesPerRow,
                      space: CGColorSpaceCreateDeviceRGB(),
                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                  )
            else { return false }
            context.interpolationQuality = .medium
            context.draw(
                image,
                in: CGRect(x: 0, y: 0, width: gridSize, height: gridSize)
            )
            return true
        }
        guard drawn else { return Sample(hasTransparency: false, meanLuminance: 0) }
        return summarize(pixels)
    }

    /// The buffer is premultiplied, so a translucent white pixel arrives dim.
    /// Dividing the colour back out is what keeps a 20%-opaque white logo from
    /// being read as almost black and handed the wrong grid.
    private static func summarize(_ pixels: [UInt8]) -> Sample {
        var hasTransparency = false
        var luminanceTotal = 0.0
        var alphaTotal = 0.0
        for index in stride(from: 0, to: pixels.count, by: 4) {
            let alpha = Double(pixels[index + 3]) / 255
            if alpha < opaqueAlphaFloor { hasTransparency = true }
            guard alpha > 0 else { continue }
            let red = Double(pixels[index]) / 255 / alpha
            let green = Double(pixels[index + 1]) / 255 / alpha
            let blue = Double(pixels[index + 2]) / 255 / alpha
            // Rec. 709 luma, on the gamma-encoded values the eye is judging.
            let luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
            luminanceTotal += min(1, luminance) * alpha
            alphaTotal += alpha
        }
        return Sample(
            hasTransparency: hasTransparency,
            meanLuminance: alphaTotal > 0 ? luminanceTotal / alphaTotal : 0
        )
    }
}
