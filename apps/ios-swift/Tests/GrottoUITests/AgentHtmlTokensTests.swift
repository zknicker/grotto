import Testing
@testable import GrottoUI

/// The token table is generated from the app's own stylesheets
/// (`bun run gen:ios-tokens`); drift against the published contract is caught
/// on the TypeScript side. These assertions guard the Swift shape the sandbox
/// document depends on.
@Suite struct AgentHtmlTokensTests {
    /// 38 snapshotted taught names plus the two derived chart-chrome
    /// declarations that complete the 40-name taught vocabulary. That is the
    /// whole contract: there is no alias tail.
    private let expectedCount = 40

    /// Names the contract used to publish as aliases. Nothing emits them any
    /// more; a stored visual that references one must be reauthored.
    private let retiredNames = [
        "--brand", "--info-bg", "--primary", "--radius-2xl", "--label-teal-fg", "--card",
        "--popover", "--subtle", "--destructive", "--input", "--ring", "--font-heading",
        "--app-code-font-size", "--t-normal", "--ease-standard", "--radius-lg",
        "--foreground-quaternary", "--surface-shadow", "--overlay-shadow",
    ]

    @Test func bothSchemesCarryTheWholeContract() {
        #expect(AgentHtmlTokens.dark.count == expectedCount)
        #expect(AgentHtmlTokens.light.count == expectedCount)
        #expect(AgentHtmlTokens.table(for: .dark) == AgentHtmlTokens.dark)
        #expect(AgentHtmlTokens.table(for: .light) == AgentHtmlTokens.light)
    }

    @Test func schemesDeclareTheSameNamesInTheSameOrder() {
        #expect(AgentHtmlTokens.dark.map(\.name) == AgentHtmlTokens.light.map(\.name))
    }

    /// One name from each of the eight taught groups.
    @Test func carriesTheNamesTheSkillTeaches() {
        let names = Set(AgentHtmlTokens.dark.map(\.name))
        for name in [
            "--font-sans", "--surface-secondary", "--muted-foreground", "--border-strong",
            "--accent-bg", "--warning-bg", "--chart-grid", "--chart-label", "--radius-card",
            "--pad-md", "--gap-sm",
        ] {
            #expect(names.contains(name), "missing \(name)")
        }
    }

    /// The taught vocabulary is the only contract: a retired name is gone from
    /// the table rather than kept alive as an alias.
    @Test func emitsNoRetiredName() {
        let names = Set(AgentHtmlTokens.dark.map(\.name) + AgentHtmlTokens.light.map(\.name))
        for name in retiredNames {
            #expect(!names.contains(name), "still emitting retired \(name)")
        }
    }

    /// The layout group is derived from HeroUI's own steps: the fields radius
    /// tier off a 6px `--radius`, the capped shell tier, and pads on `--spacing`.
    @Test func resolvesTheLayoutGroupToTheHeroUISteps() {
        let dark = Dictionary(
            uniqueKeysWithValues: AgentHtmlTokens.dark.map { ($0.name, $0.value) }
        )
        #expect(dark["--radius"] == "9px")
        #expect(dark["--radius-card"] == "18px")
        #expect(dark["--pad-lg"] == "15px")
        #expect(dark["--gap-xs"] == "3.75px")
    }

    /// Values ship self-contained: the frame has no app stylesheet to resolve
    /// a `var()` or fold a `calc()` against.
    @Test func valuesAreLiteral() {
        for token in AgentHtmlTokens.dark + AgentHtmlTokens.light {
            #expect(!token.value.contains("var("), "\(token.name) kept a var()")
            #expect(!token.value.contains("calc("), "\(token.name) kept a calc()")
            #expect(!token.value.contains("min("), "\(token.name) kept a min()")
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
