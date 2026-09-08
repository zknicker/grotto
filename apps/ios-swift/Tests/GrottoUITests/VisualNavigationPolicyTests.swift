#if canImport(WebKit)
import Foundation
import Testing
import WebKit
@testable import GrottoUI

/// The visual frame's navigation rule. The document is attacker-controlled, so
/// the allowance for the card's own load must not be something the document can
/// spend.
struct VisualNavigationPolicyTests {
    private func decide(
        awaiting: Bool = true,
        mainFrame: Bool = true,
        type: WKNavigationType = .other,
        url: String? = "about:blank"
    ) -> VisualNavigationDecision {
        VisualNavigationPolicy.decide(
            isAwaitingOwnLoad: awaiting,
            isMainFrame: mainFrame,
            navigationType: type,
            url: url.flatMap(URL.init(string:))
        )
    }

    @Test func allowsTheDocumentTheCardLoaded() {
        #expect(decide() == .allow)
        // `loadHTMLString(_, baseURL: nil)` is the only load with no destination
        // of its own to name.
        #expect(decide(url: nil) == .allow)
    }

    /// The race the boolean alone could not survive: a hostile document sets
    /// `location.href` while the card's own reload is in flight. That
    /// navigation is `.other` on the main frame with the flag still armed, and
    /// only the URL tells it apart from ours.
    @Test func refusesAScriptedNavigationRacingTheCardsOwnLoad() {
        #expect(decide(url: "https://evil.example/steal") == .cancel)
        #expect(decide(url: "data:text/html,<h1>hi") == .cancel)
        #expect(decide(url: "file:///etc/passwd") == .cancel)
        #expect(decide(url: "javascript:alert(1)") == .cancel)
    }

    @Test func refusesEverythingOnceTheOwnLoadIsSpent() {
        #expect(decide(awaiting: false) == .cancel)
    }

    @Test func refusesASubframeNavigation() {
        #expect(decide(mainFrame: false) == .cancel)
    }

    @Test func opensAnHttpLinkTheModelWroteInTheSystemBrowser() {
        #expect(
            decide(awaiting: false, type: .linkActivated, url: "https://grotto.dev/docs")
                == .openExternally(URL(string: "https://grotto.dev/docs")!)
        )
        #expect(
            decide(awaiting: false, type: .linkActivated, url: "http://example.com")
                == .openExternally(URL(string: "http://example.com")!)
        )
    }

    @Test func refusesALinkThatIsNotHttp() {
        #expect(decide(awaiting: false, type: .linkActivated, url: "javascript:alert(1)") == .cancel)
        #expect(decide(awaiting: false, type: .linkActivated, url: "file:///etc/passwd") == .cancel)
    }
}

#endif
