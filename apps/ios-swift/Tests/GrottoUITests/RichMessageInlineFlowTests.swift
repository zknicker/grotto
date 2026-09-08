import Foundation
@testable import GrottoUI
import SwiftUI
import Testing

/// A mention flows with the words around it. Rendering each segment as its own
/// subview could not do that — a multi-word run measures at the full column
/// width, so the chip and everything after it landed on their own rows, which
/// cost this sentence about two extra lines.
@MainActor
struct RichMessageInlineFlowTests {
    private let lead = "Can you finish the Merchbase MCP connection for"
    private let tail = ", then ping me and we can ship it today and tomorrow."

    @Test func flowsAMentionInlineWithTheWordsAroundIt() {
        let inline = renderedHeight([.text(lead), .reference(marlow), .text(tail)])
        let flattened = renderedHeight([.text(lead + marlow.label + tail)])
        let chipHeight = Int(chipSize().height.rounded(.up))

        #expect(flattened > 0)
        #expect(inline >= flattened)
        // The chip may only make its own line taller; a wrapped line is more.
        #expect(inline <= flattened + chipHeight)
    }

    /// The defect this fit exists to prevent: an inline image run's height and
    /// its baseline offset are both added to the line, so an unbudgeted chip
    /// spaced its line several points further from the lines above and below.
    @Test func keepsAChipLineAtThePitchOfAPlainLine() {
        let plain = renderedHeight([.text("alpha\n\(marlow.label)\nbravo")])
        let chipped = renderedHeight([.text("alpha\n"), .reference(marlow), .text("\nbravo")])

        #expect(plain > 0)
        #expect(abs(chipped - plain) <= 2)
    }

    /// The rendered check above runs on the macOS text engine at its own body
    /// size. The fit arithmetic is the portable claim, so it is asserted
    /// directly against the font metrics of a default and an accessibility
    /// body size, at both display scales.
    @Test func sizesAChipToTheFontsLineBudget() {
        for bodySize in Self.bodyPointSizes {
            let metrics = sanFrancisco(pointSize: bodySize)
            for displayScale in [CGFloat(2), 3] {
                let fit = InlineChipFit(metrics: metrics, displayScale: displayScale)

                // A twentieth of the line: one point at default type.
                #expect(fit.lineGrowth(metrics) <= metrics.lineHeight * 0.05 + 0.001)
                #expect(fit.baselineOffset < 0)
                // Tall enough to hold its mark, short enough to stay in the line.
                #expect(fit.height > metrics.xHeight)
                #expect(fit.height <= metrics.ascent + metrics.leading)
                // Whole pixels, so the rasterizer cannot round it over budget.
                #expect((fit.height * displayScale).truncatingRemainder(dividingBy: 1) < 0.001)
            }
        }
    }

    /// The box is the fit's to decide; what goes inside it belongs to the
    /// sentence. A label sized as a fraction of that box read as a shrunken
    /// pill beside body text, so it follows the surrounding point size — and
    /// the mark still has to fit the box it is inset into at every type size.
    @Test func fillsTheChipBoxWithALabelSizedFromTheSurroundingText() {
        for bodySize in Self.bodyPointSizes {
            let metrics = sanFrancisco(pointSize: bodySize)
            let chip = proportions(forBody: metrics)

            // A shade under the words around it, the way the App's chip is.
            #expect(chip.labelSize >= metrics.pointSize * 0.85)
            #expect(chip.labelSize <= metrics.pointSize * 0.92)
            // The label's em box still belongs to the capsule.
            #expect(chip.labelSize < chip.height)
            // The mark fills what the insets leave, and nothing spills out.
            #expect(chip.markSize > 0)
            #expect(abs(chip.markSize + chip.inset * 2 - chip.height) < 0.001)
            #expect(chip.markSize >= chip.height * 0.75)
            #expect(chip.inset > 0)
            #expect(chip.markGap > chip.inset)
            #expect(chip.trailingInset > chip.markGap)
        }
    }

    /// The label is lifted rather than centered. Its line box is taller than
    /// the capsule, so centering left the descenders hanging through the
    /// bottom edge, where `ImageRenderer` — bounded to the chip's frame — cut
    /// them off flat: on an iPhone the tails of "Blippy" read as a straight
    /// line along the capsule.
    @Test func keepsTheLabelsDescendersInsideTheCapsule() {
        for bodySize in Self.bodyPointSizes {
            let metrics = sanFrancisco(pointSize: bodySize)
            let chip = proportions(forBody: metrics)
            let label = sanFrancisco(pointSize: chip.labelSize)

            #expect(chip.labelLift > 0)
            // The whole descender is inside the box the chip is drawn in.
            #expect(chip.labelBaseline + label.descent <= chip.height + 0.001)
            // And the lift never shears the capitals off the top.
            #expect(chip.labelBaseline - label.capHeight >= 1)
        }
    }

    /// The rasterized chip is reused while nothing about it changes, and drawn
    /// again the moment something does — here, the color scheme and Bold Text.
    @Test func reusesARasterizedChipUntilItsInputsChange() {
        let light = RichReferenceChipRaster.shared.image(for: marlow, style: style(.light))
        let sameLight = RichReferenceChipRaster.shared.image(for: marlow, style: style(.light))
        let dark = RichReferenceChipRaster.shared.image(for: marlow, style: style(.dark))
        let bold = RichReferenceChipRaster.shared.image(
            for: marlow,
            style: style(.light, legibilityWeight: .bold)
        )

        #expect(light != nil)
        #expect(light?.image === sameLight?.image)
        #expect(light?.image !== dark?.image)
        #expect(light?.image !== bold?.image)
    }

    @Test func keepsInteriorLineBreaksAroundAMention() {
        let single = renderedHeight([.text("Ping "), .reference(marlow), .text(" today.")])
        let broken = renderedHeight([.text("Ping "), .reference(marlow), .text("\ntoday.")])

        #expect(single > 0)
        #expect(broken > single)
    }

    /// A default body size and the size an accessibility setting reaches.
    private static let bodyPointSizes: [CGFloat] = [17, 40]

    /// SF's vertical metrics at a point size, as UIKit reports them: no
    /// leading, and ascent, descent, cap height, and x-height in fixed
    /// proportion to the size.
    ///
    /// The fit and the proportions are asked for numbers, not for a platform.
    /// `PlatformTextMetrics` resolves Dynamic Type on iOS alone — on macOS,
    /// where these tests run, a text style has exactly one size — so a loop
    /// over `DynamicTypeSize` asserted the same numbers twice while claiming
    /// accessibility coverage. Driving the arithmetic from these exercises it
    /// at two genuinely different sizes on any platform.
    private func sanFrancisco(pointSize: CGFloat) -> PlatformFontMetrics {
        PlatformFontMetrics(
            pointSize: pointSize,
            ascent: pointSize * 0.956,
            descent: pointSize * 0.2406,
            leading: 0,
            xHeight: pointSize * 0.5273,
            capHeight: pointSize * 0.7132
        )
    }

    private func proportions(forBody metrics: PlatformFontMetrics) -> RichReferenceChipProportions {
        let fit = InlineChipFit(metrics: metrics, displayScale: 3)
        return RichReferenceChipProportions(
            height: fit.height,
            textPointSize: metrics.pointSize,
            labelMetrics: sanFrancisco(
                pointSize: RichReferenceChipProportions.labelPointSize(
                    forText: metrics.pointSize
                )
            )
        )
    }

    private var marlow: RichReferencePresentation {
        RichReferencePresentation(id: "agt_marlow", kind: .agent, label: "Marlow", avatarURL: nil)
    }

    private func style(
        _ colorScheme: ColorScheme,
        legibilityWeight: LegibilityWeight? = nil
    ) -> RichReferenceChipStyle {
        let metrics = PlatformTextMetrics.metrics(for: .body, dynamicTypeSize: .large)
        return RichReferenceChipStyle(
            colorScheme: colorScheme,
            displayScale: 2,
            dynamicTypeSize: .large,
            legibilityWeight: legibilityWeight,
            proportions: RichReferenceChipProportions(
                height: InlineChipFit(metrics: metrics, displayScale: 2).height,
                textPointSize: metrics.pointSize
            ),
            hasAvatarImage: false,
            hasChannelGlyph: false
        )
    }

    private func chipSize() -> CGSize {
        RichReferenceChipRaster.shared.image(for: marlow, style: style(.light))?.size ?? .zero
    }

    private func renderedHeight(_ segments: [RichMessageSegment]) -> Int {
        let renderer = ImageRenderer(
            content: RichMessageContentView(segments: segments)
                .frame(width: 280, alignment: .leading)
        )
        renderer.scale = 1
        return renderer.cgImage?.height ?? 0
    }
}
