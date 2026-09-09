import Foundation
@testable import GrottoUI
import SwiftUI
import Testing

/// What a tap can reach in a message body.
///
/// Everything that opens carries a real `.link`, because the text engine is
/// what finds a link and decides the tap: the single tap that opens it, the
/// menu the delegate refuses, and the VoiceOver links rotor all come from that
/// one attribute. Everything else carries none, so it is inert rather than
/// silently tappable.
@MainActor
struct RichMessageLinkRunTests {
    /// A link this client does not chip is a link, not a capsule and not raw
    /// Markdown: its own underlined words, carrying the address the system can
    /// route.
    @Test func writesTheAddressAsALinkOnAnAnchorsOwnWords() {
        let body = makeBody([
            .text("Open "),
            .link(text: "the notes", target: "mailto:ada@grotto.dev"),
            .text(" and "),
            .link(text: "report.html", target: "grotto://workspace/out/report.html"),
        ])

        // No capsule and no spacers, so a copy reads as the anchor's own words.
        #expect(body.string == "Open the notes and report.html")
        #expect(body.attribute(.grottoReference, at: 5, effectiveRange: nil) == nil)
        #expect(underline(body, at: 5) == NSUnderlineStyle.single.rawValue)
        #expect(underline(body, at: 0) == nil)
        // A scheme the system routes is tappable; a workspace resource names an
        // in-app target nothing opens yet, and the words around both are prose.
        #expect(link(body, at: 5) == "mailto:ada@grotto.dev")
        #expect(link(body, at: 20) == nil)
        #expect(link(body, at: 0) == nil)
    }

    /// A chip whose target is a real address is a link too — over its whole
    /// run, so the capsule's padding opens it rather than leaving a dead margin
    /// inside the chip.
    @Test func writesTheAddressAcrossAWebChipsWholeRun() {
        let releases = RichReferencePresentation(
            id: "https://grotto.dev/releases", kind: .website, label: "notes", avatarURL: nil
        )
        let body = makeBody([.text("Ship "), .reference(releases)])

        #expect(body.attribute(.grottoReference, at: 7, effectiveRange: nil) != nil)
        for index in 5..<body.length {
            #expect(link(body, at: index) == releases.id, "link at \(index)")
        }
    }

    /// A chip naming a Grotto record the phone has no route to is not a link at
    /// all: nothing to tap, and nothing in the links rotor.
    @Test func leavesEveryUnroutableReferenceWithoutALink() {
        let marlow = RichReferencePresentation(
            id: "agt_marlow", kind: .agent, label: "Marlow", avatarURL: nil
        )
        let body = makeBody([.text("Ping "), .reference(marlow)])

        for index in 0..<body.length {
            #expect(link(body, at: index) == nil, "link at \(index)")
        }
    }

    private func makeBody(_ segments: [RichMessageSegment]) -> NSAttributedString {
        RichMessageAttributedText.make(
            segments: segments,
            font: PlatformTextMetrics.font(for: .body, dynamicTypeSize: .large),
            metrics: PlatformTextMetrics.metrics(for: .body, dynamicTypeSize: .large)
        )
    }

    private func link(_ body: NSAttributedString, at index: Int) -> String? {
        (body.attribute(.link, at: index, effectiveRange: nil) as? URL)?.absoluteString
    }

    private func underline(_ body: NSAttributedString, at index: Int) -> Int? {
        body.attribute(.underlineStyle, at: index, effectiveRange: nil) as? Int
    }
}
