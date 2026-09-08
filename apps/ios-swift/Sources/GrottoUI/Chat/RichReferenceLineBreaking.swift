import CoreGraphics
import Foundation

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// When a mention's words may come apart.
///
/// A label wears one capsule, so its words belong together — but only as long
/// as together is possible. Sealing every break opportunity inside the label
/// (the old non-breaking spaces and joiners) made the label one unbreakable
/// token, and at an accessibility Dynamic Type size a token wider than the
/// column leaves the engine no choice but to wrap it by character: "Product
/// Desig" / "n Team". So the label keeps real spaces and hyphens, and the
/// break policy is decided per opportunity instead: refuse every break inside
/// a run that fits on a line by itself, allow the run's own word boundaries
/// when it cannot. Each resulting fragment still gets its own capsule.
enum RichReferenceLineBreaking {
    /// Whether the engine may break a line before `characterIndex`.
    ///
    /// `runRange` is the `.grottoReference` run covering that index, or `nil`
    /// outside one. Breaking before a run's first character is how a mention
    /// moves whole to the next line, so it is always allowed.
    static func shouldBreakByWord(
        at characterIndex: Int,
        runRange: NSRange?,
        runWidth: CGFloat,
        containerWidth: CGFloat
    ) -> Bool {
        guard let runRange, characterIndex > runRange.location else { return true }
        // First layout, before the container has been given the row's width:
        // answer as if the label fits, so a mention is never taken apart on a
        // width nobody has measured yet.
        guard containerWidth > 0 else { return false }
        return runWidth > containerWidth
    }

    /// Whether the engine may hyphenate before `characterIndex`. A name is
    /// never hyphenated, however little room is left.
    static func shouldBreakByHyphenating(at characterIndex: Int, runRange: NSRange?) -> Bool {
        guard let runRange, characterIndex > runRange.location else { return true }
        return false
    }

    /// The usable line width inside a container: its width less the padding it
    /// keeps on both edges.
    static func usableWidth(ofContainerWidth width: CGFloat, lineFragmentPadding: CGFloat) -> CGFloat {
        max(0, width - lineFragmentPadding * 2)
    }
}

/// The layout manager delegate that answers with the policy above.
///
/// `NSLayoutManager.delegate` is weak, so this is owned by
/// `RichReferenceLayoutManager`; on macOS it is built directly by the tests,
/// which is the only reason it is not filed with the renderer.
final class RichReferenceLineBreaker: NSObject, NSLayoutManagerDelegate {
    func layoutManager(
        _ layoutManager: NSLayoutManager,
        shouldBreakLineByWordBeforeCharacterAt charIndex: Int
    ) -> Bool {
        guard let run = run(in: layoutManager, at: charIndex) else { return true }
        return RichReferenceLineBreaking.shouldBreakByWord(
            at: charIndex,
            runRange: run.range,
            runWidth: run.width,
            containerWidth: usableWidth(of: layoutManager)
        )
    }

    func layoutManager(
        _ layoutManager: NSLayoutManager,
        shouldBreakLineByHyphenatingBeforeCharacterAt charIndex: Int
    ) -> Bool {
        guard let run = run(in: layoutManager, at: charIndex) else { return true }
        return RichReferenceLineBreaking.shouldBreakByHyphenating(at: charIndex, runRange: run.range)
    }

    /// The reference run covering `charIndex`, with the natural width measured
    /// when the body was built. The cheap `effectiveRange: nil` probe comes
    /// first so an ordinary word costs one attribute lookup and nothing else.
    private func run(
        in layoutManager: NSLayoutManager,
        at charIndex: Int
    ) -> (range: NSRange, width: CGFloat)? {
        guard let storage = layoutManager.textStorage, charIndex < storage.length,
              storage.attribute(.grottoReference, at: charIndex, effectiveRange: nil) != nil
        else { return nil }
        var range = NSRange(location: 0, length: 0)
        guard let reference = storage.attribute(
            .grottoReference,
            at: charIndex,
            longestEffectiveRange: &range,
            in: NSRange(location: 0, length: storage.length)
        ) as? RichReferenceRun
        else { return nil }
        return (range, reference.naturalWidth)
    }

    private func usableWidth(of layoutManager: NSLayoutManager) -> CGFloat {
        guard let container = layoutManager.textContainers.first else { return 0 }
        return RichReferenceLineBreaking.usableWidth(
            ofContainerWidth: container.size.width,
            lineFragmentPadding: container.lineFragmentPadding
        )
    }
}
