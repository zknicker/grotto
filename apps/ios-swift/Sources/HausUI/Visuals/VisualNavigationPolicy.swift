#if canImport(WebKit)
import Foundation
import WebKit

/// What a visual frame is allowed to do with one navigation.
enum VisualNavigationDecision: Equatable {
    /// The document the card handed the frame.
    case allow
    /// A link the model wrote, opened in the system browser instead.
    case openExternally(URL)
    case cancel
}

/// The navigation rule for a visual frame, kept pure so it can be tested
/// without a `WKWebView`.
///
/// Treat the document as attacker-controlled. The frame navigates exactly once,
/// to the document the card loaded, and nothing navigates it away afterwards.
enum VisualNavigationPolicy {
    /// The pending-load flag alone is not enough to key the allow branch on: a
    /// hostile document can set `location.href` while the card's own reload is
    /// in flight and consume the allowance. `loadHTMLString(_, baseURL: nil)`
    /// navigates to `about:blank`, so the allowance also requires that — a
    /// navigation to anything with a real URL is refused whatever else is
    /// pending. A URL-less request is treated as our own for the same reason:
    /// only WebKit's own synthetic load has no destination to name.
    static func decide(
        isAwaitingOwnLoad: Bool,
        isMainFrame: Bool,
        navigationType: WKNavigationType,
        url: URL?
    ) -> VisualNavigationDecision {
        if isAwaitingOwnLoad, isMainFrame, navigationType == .other, isOwnDocument(url) {
            return .allow
        }
        if navigationType == .linkActivated,
           let url,
           url.scheme == "http" || url.scheme == "https" {
            return .openExternally(url)
        }
        return .cancel
    }

    private static func isOwnDocument(_ url: URL?) -> Bool {
        guard let url else { return true }
        return url.scheme == nil || url.scheme == "about"
    }
}

#endif
