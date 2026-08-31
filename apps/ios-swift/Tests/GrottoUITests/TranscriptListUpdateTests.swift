@testable import GrottoUI
import Testing

/// The transcript substrate acts on exact snapshot-to-snapshot classification,
/// not scroll geometry: these pin the shapes a Chat's page can take.
struct TranscriptListUpdateTests {
    @Test func unchangedIDsAreARefresh() {
        #expect(
            TranscriptListUpdate.classify(old: ["a", "b"], new: ["a", "b"]) == .refresh
        )
    }

    @Test func newerMessagesAtTheTailAreAnAppend() {
        #expect(
            TranscriptListUpdate.classify(old: ["a", "b"], new: ["a", "b", "c", "d"])
                == .append(appended: 2)
        )
    }

    @Test func olderHistoryAtTheHeadIsAPrepend() {
        #expect(
            TranscriptListUpdate.classify(old: ["c", "d"], new: ["a", "b", "c", "d"])
                == .prepend(prepended: 2)
        )
    }

    @Test func aFirstPageIsAReset() {
        #expect(
            TranscriptListUpdate.classify(old: [], new: ["a", "b"]) == .reset
        )
    }

    @Test func anEmptyTranscriptStayingEmptyIsARefresh() {
        #expect(TranscriptListUpdate.classify(old: [], new: []) == .refresh)
    }

    @Test func aShrunkenPageIsAReset() {
        #expect(
            TranscriptListUpdate.classify(old: ["a", "b", "c"], new: ["b", "c"]) == .reset
        )
    }

    @Test func aRewrittenPageIsAReset() {
        #expect(
            TranscriptListUpdate.classify(old: ["a", "b"], new: ["x", "y", "z"]) == .reset
        )
        #expect(
            TranscriptListUpdate.classify(old: ["a", "b"], new: ["a", "x"]) == .reset
        )
    }

    @Test func aSimultaneousPrependAndAppendIsAReset() {
        // Both ends growing at once cannot anchor either edge exactly.
        #expect(
            TranscriptListUpdate.classify(old: ["b"], new: ["a", "b", "c"]) == .reset
        )
    }
}
