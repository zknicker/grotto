import Testing
@testable import GrottoUI

/// The token table is generated from the app's own stylesheets
/// (`bun run gen:ios-tokens`); drift against the published contract is caught
/// on the TypeScript side. These assertions guard the Swift shape the sandbox
/// document depends on.
@Suite struct AgentHtmlTokensTests {
    /// 72 published names plus the two derived chart-chrome declarations.
    private let expectedCount = 74

    @Test func bothSchemesCarryTheWholeContract() {
        #expect(AgentHtmlTokens.dark.count == expectedCount)
        #expect(AgentHtmlTokens.light.count == expectedCount)
        #expect(AgentHtmlTokens.table(for: .dark) == AgentHtmlTokens.dark)
        #expect(AgentHtmlTokens.table(for: .light) == AgentHtmlTokens.light)
    }

    @Test func schemesDeclareTheSameNamesInTheSameOrder() {
        #expect(AgentHtmlTokens.dark.map(\.name) == AgentHtmlTokens.light.map(\.name))
    }

    @Test func carriesTheNamesTheSkillTeaches() {
        let names = Set(AgentHtmlTokens.dark.map(\.name))
        for name in ["--chart-1", "--ease-standard", "--chart-grid", "--chart-label", "--font-sans"] {
            #expect(names.contains(name), "missing \(name)")
        }
    }

    /// Values ship self-contained: the frame has no app stylesheet to resolve
    /// a `var()` or fold a `calc()` against.
    @Test func valuesAreLiteral() {
        for token in AgentHtmlTokens.dark + AgentHtmlTokens.light {
            #expect(!token.value.contains("var("), "\(token.name) kept a var()")
            #expect(!token.value.contains("calc("), "\(token.name) kept a calc()")
            #expect(!token.value.isEmpty, "\(token.name) is empty")
        }
    }

    @Test func documentPinsItsSandboxAndDeclaresTheTokens() {
        let document = VisualSandboxDocument.make(
            html: "<p>hi</p>",
            scheme: .light,
            typography: .web
        )
        #expect(document.contains("default-src 'none'"))
        #expect(document.contains("https://cdn.jsdelivr.net/npm/chart.js@4.5.1/"))
        #expect(document.contains("color-scheme: light"))
        #expect(document.contains("--chart-1:"))
        #expect(document.contains("grottoVisualSize"))
        // The model body parses last, so a partial one still renders.
        #expect(document.range(of: "<p>hi</p>")!.lowerBound > document.range(of: "</head>")!.lowerBound)
    }
}
