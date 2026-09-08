import SwiftUI
import Testing
@testable import GrottoUI

/// The sandbox document is a port of the web card's `buildVisualSrcDoc`
/// (`apps/website/src/features/chats/visual-card.tsx`). These assertions pin
/// the shape the two share, and the one place iOS deliberately diverges.
struct VisualSandboxDocumentTests {
    private func makeDocument(
        html: String = "<p>hi</p>",
        scheme: AgentHtmlColorScheme = .light,
        typography: VisualTypography = .web
    ) -> String {
        VisualSandboxDocument.make(html: html, scheme: scheme, typography: typography)
    }

    /// The web's newest base rule: native controls inherit the frame's ink
    /// instead of painting the browser accent.
    @Test func paintsNativeControlsWithTheFrameInkNotTheBrowserAccent() {
        let document = makeDocument(html: "<input type=\"range\">")

        #expect(document.contains("accent-color: var(--primary, currentColor)"))
        // Same position as the web: immediately after the box-sizing reset.
        let reset = document.range(of: "* { box-sizing: border-box; }")!
        let accent = document.range(of: "body { accent-color: var(--primary, currentColor); }")!
        let margin = document.range(of: "body { margin: 0;")!
        #expect(reset.upperBound < accent.lowerBound)
        #expect(accent.upperBound < margin.lowerBound)
    }

    // MARK: - overflowing tables

    /// A table wider than the card would otherwise be cut off: the frame's own
    /// scroll view is disabled, so the document gives each table a scroller.
    @Test func wrapsTablesInAHorizontalScrollerBeforeTheFirstReport() {
        let document = makeDocument(html: "<table><tr><td>wide</td></tr></table>")

        #expect(document.contains("data-grotto-table-scroll"))
        #expect(
            document.contains(
                "overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch;"
            )
        )
        let wrap = document.range(of: "wrapWideTables();")!
        let report = document.range(of: "report();")!
        let body = document.range(of: "<table><tr><td>wide</td></tr></table>")!
        #expect(wrap.upperBound < report.lowerBound)
        #expect(report.upperBound < body.lowerBound)
    }

    /// The wrapper is layout only. Nothing forces the table to `display: block`,
    /// so a narrow table still spans the card.
    @Test func leavesTableLayoutAlone() {
        let document = makeDocument()

        #expect(document.contains("table { width: 100%; border-collapse: collapse;"))
        #expect(!document.contains("display: block"))
    }

    /// The wrapper scrolls the caption out with the columns it labels unless
    /// the caption sticks to the scrollport and stops being table-wide. Both
    /// halves are load-bearing, and both platforms carry the same rule.
    @Test func keepsATableCaptionVisibleWhileTheTablePans() {
        let document = makeDocument(html: "<table><caption>Sales</caption></table>")

        #expect(
            document.contains(
                "caption { position: sticky; left: 0; width: max-content; max-width: 100%;"
            )
        )
    }

    @Test func keepsTheResizeObserverOnTheBody() {
        #expect(makeDocument().contains("new ResizeObserver(report).observe(document.body)"))
    }

    // MARK: - Dynamic Type

    /// The one deliberate divergence from the generated table: the card's body
    /// text matches the transcript around it rather than the web chat's 14px.
    @Test func overridesTheTwoFontSizeTokensAfterTheGeneratedTable() {
        let document = makeDocument(typography: VisualTypography(uiFontSize: 17, codeFontSize: 16))

        #expect(document.contains("--app-ui-font-size: 17px;"))
        #expect(document.contains("--app-code-font-size: 16px;"))
        // The generated 14px/13px values still ship; source order is what
        // settles the conflict, so the overrides must come last.
        let generated = document.range(of: "--app-ui-font-size: 0.875rem;")!
        let override = document.range(of: "--app-ui-font-size: 17px;")!
        #expect(generated.upperBound < override.lowerBound)
        #expect(document.range(of: "}")!.upperBound > override.lowerBound)
    }

    @Test func keepsEveryOtherTokenExactlyAsGenerated() {
        let document = makeDocument(scheme: .dark, typography: VisualTypography(uiFontSize: 17, codeFontSize: 16))

        for token in AgentHtmlTokens.dark
        where token.name != "--app-ui-font-size" && token.name != "--app-code-font-size" {
            #expect(document.contains("\(token.name): \(token.value);"), "dropped \(token.name)")
        }
    }

    @Test func resolvesBothSizesFromTheDynamicTypeSize() {
        let small = VisualTypography.resolved(for: .large)
        let huge = VisualTypography.resolved(for: .accessibility5)

        #expect(small.uiFontSize > 0)
        #expect(small.codeFontSize > 0)
        // Code is the smaller of the pair at every size, the way 13 is to 14.
        #expect(small.codeFontSize < small.uiFontSize)
        #expect(huge.codeFontSize < huge.uiFontSize)
        #if canImport(UIKit)
        // An accessibility size has to actually scale the card, or the visual
        // stays small while the transcript around it grows.
        #expect(huge.uiFontSize > small.uiFontSize)
        #expect(small.uiFontSize == 17)
        #expect(small.codeFontSize == 16)
        #endif
    }

    @Test func writesWholePointSizesAsWholePixels() {
        #expect(VisualTypography.css(17) == "17px")
        #expect(VisualTypography.css(16.5) == "16.5px")
    }
}
