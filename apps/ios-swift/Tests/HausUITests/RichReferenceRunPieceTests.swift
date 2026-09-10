import CoreGraphics
import Foundation
@testable import HausUI
import Testing

/// Where a reference's mark and its dotted rule land on one line fragment,
/// given the rects the text engine reports for that fragment.
///
/// The mark rides the run's *leading* edge and the rule runs under the label's
/// own glyphs. Neither is the fragment's left edge: in an RTL paragraph the
/// spacer advances at the right, so a mark placed at the left lands on the
/// label's last glyphs and a rule measured off the fragment's box runs well
/// past the words on both sides. `RichReferenceBidiLayoutTests` asks the text
/// engine for those rects; this is the arithmetic done on them.
@MainActor
struct RichReferenceRunPieceTests {
    /// Left to right: the mark stands at the spacer's left edge and the rule
    /// spans the label that follows it.
    @Test func placesTheMarkAtTheSpacersLeadingEdgeRunningLeftToRight() {
        let piece = RichReferenceRunPiece(
            attachment: CGRect(x: 10, y: 0, width: 20, height: 20),
            label: CGRect(x: 30, y: 0, width: 100, height: 20),
            markSize: 16
        )

        #expect(piece.markLeadingX == 10)
        #expect(piece.underlineFromX == 30)
        #expect(piece.underlineToX == 130)
    }

    /// And that is the arithmetic the renderer used to do from the fragment's
    /// box alone, in the fixture's own geometry. Nothing moved.
    @Test func reproducesTheFragmentBoxDerivationRunningLeftToRight() {
        let geometry = RichReferenceMarkGeometry(metrics: RichReferenceMetricsFixture.sanFrancisco(pointSize: 17))
        let fragment = CGRect(x: 24, y: 0, width: 140, height: 20)
        let split = fragment.divided(atDistance: geometry.leadingSpacer, from: .minXEdge)
        let piece = RichReferenceRunPiece(
            attachment: split.slice,
            label: split.remainder,
            markSize: geometry.markSize
        )

        #expect(piece.markLeadingX == fragment.minX)
        #expect(piece.underlineFromX == fragment.minX + geometry.leadingSpacer)
        #expect(piece.underlineToX == fragment.maxX)
    }

    /// Right to left: the same spacer advances on the other side of the label,
    /// so the mark's leading edge is a mark's width back from the spacer's
    /// right side, and the rule is still the label's own extent.
    @Test func placesTheMarkAtTheSpacersLeadingEdgeRunningRightToLeft() {
        let piece = RichReferenceRunPiece(
            attachment: CGRect(x: 130, y: 0, width: 20, height: 20),
            label: CGRect(x: 30, y: 0, width: 100, height: 20),
            markSize: 16
        )

        #expect(piece.markLeadingX == 134)
        #expect(piece.underlineFromX == 30)
        #expect(piece.underlineToX == 130)
        // The whole of the defect: the mark clears the label instead of
        // painting over its final glyphs.
        #expect((piece.markLeadingX ?? 0) >= piece.underlineToX)
    }

    /// A wrapped label's continuation carries no spacer: it wears the rule
    /// alone, under every glyph on that line.
    @Test func drawsNoMarkOnAFragmentWithoutTheSpacer() {
        let piece = RichReferenceRunPiece(
            attachment: nil,
            label: CGRect(x: 0, y: 0, width: 80, height: 20),
            markSize: 16
        )

        #expect(piece.markLeadingX == nil)
        #expect(piece.underlineFromX == 0)
        #expect(piece.underlineToX == 80)
    }

    /// And a fragment holding the spacer but none of the label wears the mark
    /// alone: a rule with nothing under it draws no dots.
    @Test func drawsNoRuleWithoutLabelGlyphs() {
        let piece = RichReferenceRunPiece(
            attachment: CGRect(x: 10, y: 0, width: 20, height: 20),
            label: nil,
            markSize: 16
        )

        #expect(piece.markLeadingX == 10)
        #expect(piece.underlineFromX == piece.underlineToX)
    }
}
