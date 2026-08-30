import CoreGraphics

/// The transcript's scroll decisions, kept separate from the view that acts on
/// them: where the reader is, what a new tail message is allowed to do, and
/// whether a request to reveal one message can be satisfied yet.

/// Resolves a request to reveal one message against the loaded page.
enum MessageTimelineScrollTarget {
    enum Resolution: Equatable {
        /// No page is loaded yet; keep the request until messages arrive.
        case waiting
        case reveal(String)
        /// The loaded page does not contain the message; drop the request.
        case unavailable
    }

    static func resolve(target: String, messageIDs: [String]) -> Resolution {
        if messageIDs.isEmpty {
            return .waiting
        }
        return messageIDs.contains(target) ? .reveal(target) : .unavailable
    }
}

/// How the timeline reaches a new tail message. A page that arrives for a Chat
/// that was showing nothing is that Chat's first paint, so it has to appear
/// already settled at the bottom rather than sweeping there.
enum MessageTimelineTailScroll: Equatable {
    case ignore
    case snap
    case animate

    /// Pending rows are created only for the viewer's outgoing sends. That lets
    /// a send reveal itself even if the user had scrolled slightly above the
    /// tail; other incoming messages respect the reader's current position.
    static func decide(
        hadMessages: Bool,
        isNearBottom: Bool,
        isLatestPending: Bool
    ) -> Self {
        guard hadMessages else { return .snap }
        return isNearBottom || isLatestPending ? .animate : .ignore
    }
}

enum MessageTimelineScrollPosition {
    private static let bottomTolerance: CGFloat = 80
    /// Anything smaller than this is rounding between two layout passes, not a
    /// viewport that has left its own content behind.
    private static let overshootTolerance: CGFloat = 1

    static func isNearBottom(
        contentHeight: CGFloat,
        containerHeight: CGFloat,
        visibleMaxY: CGFloat
    ) -> Bool {
        if contentHeight <= containerHeight + 1 {
            return true
        }

        return visibleMaxY >= contentHeight - bottomTolerance
    }

    /// Whether the viewport is sitting past the end of the transcript, showing
    /// the empty space below the last row.
    ///
    /// A reader cannot put it there: a scroll view clamps every gesture to its
    /// own content and rubber-bands anything beyond it back. Only a layout can,
    /// and a Chat's first one does — the bottom lands against a content height
    /// the lazy rows have not settled into, they then measure shorter, and the
    /// viewport is left over nothing. It is a resting state, not a transient:
    /// a Chat that was already loaded never appends a message, so the tail
    /// scroll that would otherwise rescue it never runs, and the transcript
    /// stays blank until the reader drags it back.
    ///
    /// A transcript shorter than its container has no end to be past. It sits on
    /// the composer because `defaultScrollAnchor(.bottom)` pads the top by
    /// nearly a screen, which puts the viewport's trailing edge well below the
    /// last row by design — so the height has to be checked before the edge is.
    static func isPastContentEnd(
        contentHeight: CGFloat,
        containerHeight: CGFloat,
        bottomInset: CGFloat,
        visibleMaxY: CGFloat
    ) -> Bool {
        guard contentHeight > containerHeight else { return false }
        return visibleMaxY > contentHeight + bottomInset + overshootTolerance
    }
}
