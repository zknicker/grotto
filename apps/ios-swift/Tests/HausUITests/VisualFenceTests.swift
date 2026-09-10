import Foundation
@testable import HausUI
import Testing

/// The ```visual fence grammar is shared with the web app. Every case here was
/// verified against `splitVisualFences` / `visualFallbackText` in
/// `packages/haus-api/src/widgets/visual/contracts.ts`; the JavaScript output
/// is the contract, not the prose description of it.
struct VisualFenceTests {
    // MARK: - split, ported from contracts.test.ts

    @Test func splitsProseAndClosedVisualFencesInOrder() {
        let segments = VisualFence.split(
            "Here you go:\n```visual Weekly sales\n<h1>Sales</h1>\n<svg></svg>\n```\nDone."
        )

        #expect(segments == [
            .text("Here you go:\n"),
            .visual(html: "<h1>Sales</h1>\n<svg></svg>", isOpen: false, title: "Weekly sales"),
            .text("\nDone."),
        ])
    }

    @Test func treatsATrailingUnclosedFenceAsAnOpenStreamingVisual() {
        let segments = VisualFence.split("Drawing now.\n```visual\n<div><h2>Part")

        #expect(segments == [
            .text("Drawing now.\n"),
            .visual(html: "<div><h2>Part", isOpen: true, title: nil),
        ])
    }

    @Test func treatsABareFenceOpenerWithNoBodyAsAnOpenVisual() {
        #expect(VisualFence.split("```visual") == [.visual(html: "", isOpen: true, title: nil)])
    }

    @Test func keepsATitleOnAnOpenFenceThatHasNoBodyYet() {
        #expect(
            VisualFence.split("```visual My Title")
                == [.visual(html: "", isOpen: true, title: "My Title")]
        )
    }

    @Test func ignoresFenceLikeTextThatDoesNotStartALine() {
        let content = "Use a `visual` fence like ```visual inline mentions."

        #expect(VisualFence.split(content) == [.text(content)])
    }

    @Test func keepsPlainContentAsOneTextSegment() {
        #expect(VisualFence.split("No fences here.") == [.text("No fences here.")])
    }

    @Test func trimsTheInfoStringTitle() {
        #expect(
            VisualFence.split("```visual   Weekly sales   \n<b>x</b>\n```")
                == [.visual(html: "<b>x</b>", isOpen: false, title: "Weekly sales")]
        )
    }

    // MARK: - split, column and body edges

    @Test func requiresExactlyThreeBackticksAtColumnZero() {
        let fourBackticks = "````visual\n<p>hi</p>\n````"
        let leadingSpace = " ```visual\n<p>hi</p>\n```"

        #expect(VisualFence.split(fourBackticks) == [.text(fourBackticks)])
        #expect(VisualFence.split(leadingSpace) == [.text(leadingSpace)])
    }

    /// The closed pattern needs a newline before the closing fence, and an
    /// opener followed immediately by ``` has none — so the ``` is body text of
    /// an open visual, not a terminator.
    @Test func readsAnOpenerFollowedImmediatelyByAFenceAsAnOpenVisual() {
        #expect(
            VisualFence.split("```visual\n```") == [.visual(html: "```", isOpen: true, title: nil)]
        )
    }

    @Test func closesAFenceWithAnEmptyBodyWhenABlankLinePrecedesTheTerminator() {
        #expect(
            VisualFence.split("```visual\n\n```") == [.visual(html: "", isOpen: false, title: nil)]
        )
    }

    @Test func terminatesTheBodyAtTheFirstColumnZeroFence() {
        #expect(VisualFence.split("```visual\n<p>a</p>\n```\nmore\n```") == [
            .visual(html: "<p>a</p>", isOpen: false, title: nil),
            .text("\nmore\n```"),
        ])
    }

    /// The terminator line allows only spaces and tabs after the backticks.
    @Test func rejectsATerminatorLineWithTrailingProse() {
        #expect(
            VisualFence.split("```visual\n<p>1</p>\n``` trailing")
                == [.visual(html: "<p>1</p>\n``` trailing", isOpen: true, title: nil)]
        )
    }

    @Test func splitsTwoClosedFencesWithProseBetweenThem() {
        let segments = VisualFence.split(
            "A\n```visual One\n<p>1</p>\n```\nmid\n```visual Two\n<p>2</p>\n```\nend"
        )

        #expect(segments == [
            .text("A\n"),
            .visual(html: "<p>1</p>", isOpen: false, title: "One"),
            .text("\nmid\n"),
            .visual(html: "<p>2</p>", isOpen: false, title: "Two"),
            .text("\nend"),
        ])
    }

    @Test func splitsAClosedFenceThenProseThenAnUnclosedFence() {
        let segments = VisualFence.split("```visual\n<p>1</p>\n```\nprose\n```visual Two\n<p>par")

        #expect(segments == [
            .visual(html: "<p>1</p>", isOpen: false, title: nil),
            .text("\nprose\n"),
            .visual(html: "<p>par", isOpen: true, title: "Two"),
        ])
    }

    @Test func treatsAnIndentedFenceAsText() {
        let content = "  ```visual\n<p>hi</p>\n  ```"

        #expect(VisualFence.split(content) == [.text(content)])
    }

    /// The pattern consumes only the LF before the terminator, so a CRLF body
    /// line keeps its carriage return in the html.
    @Test func keepsTheCarriageReturnOfACRLFBodyLine() {
        let segments = VisualFence.split("pre\r\n```visual Title\r\n<p>hi</p>\r\n```\r\nafter")

        #expect(segments == [
            .text("pre\r\n"),
            .visual(html: "<p>hi</p>\r", isOpen: false, title: "Title"),
            .text("\r\nafter"),
        ])
    }

    @Test func yieldsNoSegmentsForEmptyContent() {
        #expect(VisualFence.split("").isEmpty)
    }

    // MARK: - body

    @Test func bodyKeepsProseAboveTheCards() {
        let body = VisualFence.body("Here you go:\n```visual Sales\n<h1>Sales</h1>\n```\nDone.")

        #expect(body.prose == "Here you go:\n\nDone.")
        #expect(body.visuals == [
            VisualSegment(ordinal: 1, html: "<h1>Sales</h1>", isOpen: false, title: "Sales"),
        ])
    }

    @Test func bodyConcatenatesEveryTextSegmentThenTrimsOnce() {
        let body = VisualFence.body(
            "\n  A\n```visual\n<p>1</p>\n```\nB\n```visual\n<p>2</p>\n```\n  \n"
        )

        #expect(body.prose == "A\n\nB")
        #expect(body.visuals.map(\.html) == ["<p>1</p>", "<p>2</p>"])
    }

    @Test func bodyOfAVisualOnlyMessageHasEmptyProse() {
        let body = VisualFence.body("```visual Chart\n<svg></svg>\n```")

        #expect(body.prose.isEmpty)
        #expect(body.visuals.count == 1)
        #expect(body.visuals[0].title == "Chart")
    }

    @Test func bodyNumbersVisualsFromOneInFenceOrder() {
        let body = VisualFence.body(
            "```visual A\n<p>1</p>\n```\n```visual B\n<p>2</p>\n```\n```visual C\n<p>3"
        )

        #expect(body.visuals.map(\.ordinal) == [1, 2, 3])
        #expect(body.visuals.map(\.id) == [1, 2, 3])
        #expect(body.visuals.map(\.title) == ["A", "B", "C"])
        #expect(body.visuals.map(\.isOpen) == [false, false, true])
    }

    // MARK: - fallbackText

    @Test func fallbackPrefersTheExplicitTitle() {
        #expect(VisualFence.fallbackText(html: "<h2>Ranked</h2>", title: "Chart") == "Chart")
    }

    @Test func fallbackUsesTheDocumentTitleNext() {
        #expect(
            VisualFence.fallbackText(html: "<title>Doc title</title><h1>Heading</h1>", title: nil)
                == "Doc title"
        )
    }

    @Test func fallbackUsesTheFirstHeadingWithInnerTagsStripped() {
        #expect(
            VisualFence.fallbackText(html: "<h3><em>Ranked</em> teams</h3>", title: nil)
                == "Ranked teams"
        )
        #expect(
            VisualFence.fallbackText(html: "<h2>Multi\n  line   text</h2>", title: nil)
                == "Multi line text"
        )
    }

    @Test func fallbackSkipsAWhitespaceOnlyTitleTag() {
        #expect(
            VisualFence.fallbackText(html: "<title>   </title><h1>Heading</h1>", title: nil)
                == "Heading"
        )
    }

    @Test func fallbackIgnoresAWhitespaceOnlyExplicitTitle() {
        #expect(VisualFence.fallbackText(html: "<p>x</p>", title: "   ") == "Visual")
    }

    @Test func fallbackIsGenericWhenNothingNamesTheVisual() {
        #expect(
            VisualFence.fallbackText(html: #"<svg viewBox="0 0 10 10"></svg>"#, title: nil)
                == "Visual"
        )
    }

    @Test func fallbackMatchesTagsCaseInsensitively() {
        #expect(VisualFence.fallbackText(html: #"<TITLE class="a">Upper</TITLE>"#, title: nil) == "Upper")
    }

    @Test func fallbackCapsTextAtFiveHundredCharacters() {
        let longHeading = "<h1>\(String(repeating: "a", count: 600))</h1>"

        #expect(VisualFence.fallbackText(html: longHeading, title: nil).count == 500)
        #expect(
            VisualFence.fallbackText(html: "<p>x</p>", title: String(repeating: "z", count: 600))
                .count == 500
        )
    }
}

/// `MessagePresentation` splits the fences off the resolved body. An adapter
/// that already needed the prose hands its split in, and the presentation must
/// be identical either way — the split runs once per message, never twice.
struct MessagePresentationFenceSplitTests {
    private let content = "Here you go:\n```visual Weekly sales\n<h1>Sales</h1>\n```\nDone."

    private func presentation(visualBody: VisualMessageBody?) -> MessagePresentation {
        MessagePresentation(
            id: "msg_1",
            author: MessageAuthorPresentation(id: "agent_1", name: "Cove", avatarURL: nil),
            content: content,
            createdAt: .now,
            visualBody: visualBody
        )
    }

    @Test func aHandedInSplitMatchesTheOneThePresentationWouldCompute() {
        let computed = presentation(visualBody: nil)
        let handedIn = presentation(visualBody: VisualFence.body(content))

        #expect(handedIn.prose == computed.prose)
        #expect(handedIn.visuals == computed.visuals)
        #expect(handedIn.prose == "Here you go:\n\nDone.")
        #expect(handedIn.visuals.map(\.title) == ["Weekly sales"])
    }
}
