import SwiftUI
import Testing
@testable import HausUI

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

    /// Native controls take the frame's emphasis role rather than the browser
    /// accent, matching HeroUI's own Checkbox and Slider fill.
    @Test func paintsNativeControlsWithTheFrameAccentNotTheBrowserOne() {
        let document = makeDocument(html: "<input type=\"range\">")

        #expect(document.contains("accent-color: var(--accent, currentColor)"))
        // Same position as the web: immediately after the box-sizing reset.
        let reset = document.range(of: "* { box-sizing: border-box; }")!
        let accent = document.range(of: "body { accent-color: var(--accent, currentColor); }")!
        let margin = document.range(of: "body { margin: 0;")!
        #expect(reset.upperBound < accent.lowerBound)
        #expect(accent.upperBound < margin.lowerBound)
    }

    // MARK: - pre-styled form controls

    /// Bare controls carry HeroUI's field and outline-button metrics in
    /// published tokens, byte-for-byte the same rules the web card emits.
    @Test func preStylesBareFormControlsInPublishedTokens() {
        let document = makeDocument(html: "<input><select></select><button>Go</button>")

        #expect(document.contains(
            "input, select, textarea { font: inherit; color: var(--foreground); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--pad-sm) var(--pad-md); }"
        ))
        #expect(document.contains(
            "button { font: inherit; font-weight: 500; color: var(--foreground); background: transparent; border: 1px solid var(--border); border-radius: var(--radius); padding: var(--pad-sm) var(--pad-md); cursor: pointer; }"
        ))
        #expect(document.contains("button:hover { background: var(--surface-secondary); }"))
        #expect(document.contains(
            "input[type=\"range\"] { width: 100%; padding: 0; border: none; background: transparent; }"
        ))
        #expect(document.contains(
            ":is(input, select, textarea, button):focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }"
        ))
        // Focus is restyled, never suppressed.
        #expect(!document.contains("outline: none"))
    }

    // MARK: - overflowing tables

    /// A table wider than the card would otherwise be cut off: the frame's own
    /// scroll view is disabled, so the document gives each table a scroller.
    @Test func wrapsTablesInAHorizontalScrollerBeforeTheFirstReport() {
        let document = makeDocument(html: "<table><tr><td>wide</td></tr></table>")

        #expect(document.contains("data-haus-table-scroll"))
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
    @Test func overridesTheBodyFontSizeAfterTheGeneratedTable() {
        let document = makeDocument(typography: VisualTypography(uiFontSize: 17))

        #expect(document.contains("--app-ui-font-size: 17px;"))
        // The generated 14px value still ships; source order is what settles
        // the conflict, so the override must come last.
        let generated = document.range(of: "--app-ui-font-size: 0.875rem;")!
        let override = document.range(of: "--app-ui-font-size: 17px;")!
        #expect(generated.upperBound < override.lowerBound)
        #expect(document.range(of: "}")!.upperBound > override.lowerBound)
    }

    @Test func keepsEveryOtherTokenExactlyAsGenerated() {
        let document = makeDocument(scheme: .dark, typography: VisualTypography(uiFontSize: 17))

        for token in AgentHtmlTokens.dark where token.name != "--app-ui-font-size" {
            #expect(document.contains("\(token.name): \(token.value);"), "dropped \(token.name)")
        }
    }

    @Test func resolvesTheBodySizeFromTheDynamicTypeSize() {
        let small = VisualTypography.resolved(for: .large)
        let huge = VisualTypography.resolved(for: .accessibility5)

        #expect(small.uiFontSize > 0)
        #if canImport(UIKit)
        // An accessibility size has to actually scale the card, or the visual
        // stays small while the transcript around it grows.
        #expect(huge.uiFontSize > small.uiFontSize)
        #expect(small.uiFontSize == 17)
        #endif
    }

    @Test func writesWholePointSizesAsWholePixels() {
        #expect(VisualTypography.css(17) == "17px")
        #expect(VisualTypography.css(16.5) == "16.5px")
    }
}
