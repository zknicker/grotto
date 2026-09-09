#if canImport(UIKit)
import SwiftUI
import UIKit

/// Paints the capsule and the identity mark behind every reference run.
///
/// This is TextKit 1. The capsule has to be drawn under real glyphs on their
/// own baseline, and `NSLayoutManager.drawBackground(forGlyphRange:at:)` is the
/// hook the text engine already calls with the container origin in view
/// coordinates — nothing has to be mapped out of a fragment's private space.
/// The stack is built explicitly in `RichMessageTextView` rather than left to
/// `UITextView`, whose choice between TextKit 1 and 2 depends on which
/// properties the view has been asked for.
final class RichReferenceLayoutManager: NSLayoutManager {
    /// Where a mention's words may come apart. `NSLayoutManager.delegate` is
    /// weak, so the answering object is owned here.
    private let lineBreaker = RichReferenceLineBreaker()

    override init() {
        super.init()
        delegate = lineBreaker
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("RichReferenceLayoutManager is built in code")
    }

    /// Claims the delegate back. `UITextView` is handed this manager already
    /// built, and the break policy failing silently would look like the
    /// character wrapping it exists to remove, so the seat is taken again once
    /// the view owns the stack.
    func claimLineBreaking() {
        guard delegate !== lineBreaker else { return }
        delegate = lineBreaker
    }

    override func drawBackground(forGlyphRange glyphsToShow: NSRange, at origin: CGPoint) {
        super.drawBackground(forGlyphRange: glyphsToShow, at: origin)
        guard let storage = textStorage,
              let container = textContainers.first,
              let context = UIGraphicsGetCurrentContext()
        else { return }

        let characters = characterRange(forGlyphRange: glyphsToShow, actualGlyphRange: nil)
        storage.enumerateAttribute(.grottoReference, in: characters) { value, range, _ in
            guard let run = value as? RichReferenceRun else { return }
            draw(run: run, characterRange: range, origin: origin, container: container, context: context)
        }
    }

    private func draw(
        run: RichReferenceRun,
        characterRange: NSRange,
        origin: CGPoint,
        container: NSTextContainer,
        context: CGContext
    ) {
        let glyphs = glyphRange(forCharacterRange: characterRange, actualCharacterRange: nil)
        guard glyphs.length > 0 else { return }

        // A run that wraps wears one capsule per line. The rects come from the
        // line fragments it touches rather than from one bounding box, which
        // would span the whole column.
        enumerateLineFragments(forGlyphRange: glyphs) { [weak self] lineRect, _, _, lineGlyphs, _ in
            guard let self else { return }
            let piece = NSIntersectionRange(glyphs, lineGlyphs)
            guard piece.length > 0 else { return }
            let bounds = self.boundingRect(forGlyphRange: piece, in: container)
            // `location(forGlyphAt:)` is relative to the line fragment rect,
            // so the baseline is the one number the capsule is anchored to.
            let baseline = lineRect.minY + self.location(forGlyphAt: piece.location).y
            let capsule = run.geometry
                .capsuleRect(leadingX: bounds.minX, baselineY: baseline, width: bounds.width)
                .offsetBy(dx: origin.x, dy: origin.y)

            context.saveGState()
            RichReferenceChipInk.ground.setFill()
            UIBezierPath(roundedRect: capsule, cornerRadius: run.geometry.cornerRadius).fill()
            context.restoreGState()

            // The mark rides the run's leading edge, so only the fragment that
            // carries the run's first glyph draws one.
            if piece.location == glyphs.location {
                RichReferenceMarkPainter.draw(
                    reference: run.reference,
                    in: run.geometry.markRect(
                        in: capsule,
                        scale: run.reference.mark.sizeScale
                    ),
                    context: context
                )
            }
        }
    }
}

/// Paints a reference's mark: a channel's glyph in its colored box, an Agent's
/// or human's avatar falling back to `AvatarView`'s initials, or the flat glyph
/// every other kind wears, in that reference's own label ink.
enum RichReferenceMarkPainter {
    /// `NSLayoutManager` draws on the main thread, but it is not main-actor
    /// isolated in the SDK and the avatar and glyph caches the mark reads are.
    /// The hop is asserted rather than awaited, and the one value crossing it
    /// is the drawing context this very thread is holding.
    static func draw(
        reference: RichReferencePresentation,
        in rect: CGRect,
        context: CGContext
    ) {
        nonisolated(unsafe) let context = context
        MainActor.assumeIsolated {
            drawMark(reference: reference, in: rect, context: context)
        }
    }

    @MainActor
    private static func drawMark(
        reference: RichReferencePresentation,
        in rect: CGRect,
        context: CGContext
    ) {
        switch reference.mark {
        case .channel(let appearance):
            drawChannel(appearance: appearance, in: rect, context: context)
        case .avatar:
            drawIdentity(reference: reference, in: rect, context: context)
        case .glyph(let name):
            drawGlyph(
                UIIconCatalog.shared.subpaths(for: name, weight: 2),
                in: rect,
                tint: RichReferenceChipInk.labelTint(for: reference),
                context: context
            )
        case .brandGlyph(let name, let brand):
            drawGlyph(
                UIIconCatalog.shared.subpaths(for: name, weight: 2),
                in: rect,
                tint: RichReferenceChipInk.brandTint(brand),
                context: context
            )
        }
    }

    @MainActor
    private static func drawChannel(
        appearance: ChannelAppearance,
        in rect: CGRect,
        context: CGContext
    ) {
        context.saveGState()
        RichReferenceChipInk.markGround(for: appearance).setFill()
        UIBezierPath(roundedRect: rect, cornerRadius: rect.height / 3).fill()
        context.restoreGState()

        // The App pairs a 24pt box with a 16pt glyph. A catalog that has not
        // finished loading, or a name it does not carry, draws the hash.
        let glyphSize = (rect.height * 2 / 3).rounded()
        let subpaths = ChannelIconCatalog.shared.subpaths(for: appearance.icon)
            ?? UIIconCatalog.shared.subpaths(for: .channel, weight: 2)
        let box = CGRect(
            x: rect.midX - glyphSize / 2,
            y: rect.midY - glyphSize / 2,
            width: glyphSize,
            height: glyphSize
        )
        drawGlyph(subpaths, in: box, tint: RichReferenceChipInk.markTint(for: appearance), context: context)
    }

    @MainActor
    private static func drawIdentity(
        reference: RichReferencePresentation,
        in rect: CGRect,
        context: CGContext
    ) {
        if let url = reference.avatarURL, let image = AvatarImageCache.shared.image(for: url) {
            context.saveGState()
            context.addEllipse(in: rect)
            context.clip()
            image.draw(in: aspectFill(image.size, in: rect))
            context.restoreGState()
            return
        }
        context.saveGState()
        RichReferenceChipInk.initialsGround.setFill()
        context.fillEllipse(in: rect)
        context.restoreGState()
        drawInitials(initials(for: reference.label), in: rect)
    }

    @MainActor
    private static func drawGlyph(
        _ subpaths: [HugeiconSubpath],
        in rect: CGRect,
        tint: UIColor,
        context: CGContext
    ) {
        let scale = min(rect.width, rect.height)
        context.saveGState()
        context.translateBy(x: rect.minX, y: rect.minY)
        context.setFillColor(tint.cgColor)
        context.setStrokeColor(tint.cgColor)
        for subpath in subpaths {
            let path = subpath.path.applying(CGAffineTransform(scaleX: scale, y: scale)).cgPath
            context.addPath(path)
            if let stroke = subpath.stroke {
                context.setLineWidth(stroke.width * scale)
                context.setLineCap(stroke.cap)
                context.setLineJoin(stroke.join)
                context.strokePath()
            } else {
                context.fillPath(using: subpath.evenOdd ? .evenOdd : .winding)
            }
        }
        context.restoreGState()
    }

    @MainActor
    private static func drawInitials(_ initials: String, in rect: CGRect) {
        let text = NSAttributedString(
            string: initials,
            attributes: [
                .font: UIFont.systemFont(ofSize: rect.height * 0.38, weight: .medium),
                .foregroundColor: RichReferenceChipInk.initialsTint,
            ]
        )
        let size = text.size()
        text.draw(at: CGPoint(x: rect.midX - size.width / 2, y: rect.midY - size.height / 2))
    }

    private static func aspectFill(_ size: CGSize, in rect: CGRect) -> CGRect {
        guard size.width > 0, size.height > 0 else { return rect }
        let scale = max(rect.width / size.width, rect.height / size.height)
        let filled = CGSize(width: size.width * scale, height: size.height * scale)
        return CGRect(
            x: rect.midX - filled.width / 2,
            y: rect.midY - filled.height / 2,
            width: filled.width,
            height: filled.height
        )
    }

    private static func initials(for name: String) -> String {
        name.split(separator: " ")
            .prefix(2)
            .compactMap(\.first)
            .map(String.init)
            .joined()
            .uppercased()
    }
}
#endif
