import SwiftUI

/// The composer's glass shell.
///
/// On iOS 26 the shell is `interactive()` system glass end to end: fill, rim, and the press-driven
/// bloom that brightens the fill and flexes the shape past its own bounds are all the system's.
/// Nothing may be overlaid on top of it — an overlay is a static layer and cannot travel with the
/// bloom, so it would double-draw the edge the moment the glass flexes under a touch.
///
/// The pre-26 fallback has no self-generated rim in either scheme, so a single hairline in the
/// label colour carries the shell's silhouette there. It is fallback-only.
/// The corners the composer's glass family is cut with.
///
/// The input rounds harder as it expands. Anything else standing on the composer — the mention card
/// — takes the resting corner, one step inside the shell it rises from, so the two read as a pair
/// rather than as one shape repeated.
enum ComposerSurfaceMetrics {
    static let restingCornerRadius: CGFloat = 24
    static let expandedCornerRadius: CGFloat = 28
}

struct ComposerGlassSurface: ViewModifier {
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        if #available(iOS 26, macOS 26, *) {
            // Untinted. A tint is what turns a glass composer into ChatGPT's flat grey slab, and
            // `.primary` in particular is the style glass vibrancy is most likely to wash out.
            content.glassEffect(.regular.interactive(), in: .rect(cornerRadius: cornerRadius))
        } else {
            content
                .background(.ultraThinMaterial, in: .rect(cornerRadius: cornerRadius))
                // Explicit label colour, not hierarchical `.primary` — glass vibrancy dissolves
                // hierarchical styles to nothing.
                .overlay {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .strokeBorder(GrottoPlatformColor.label.opacity(0.1), lineWidth: 1)
                }
        }
    }
}

extension View {
    func composerGlassSurface(cornerRadius: CGFloat) -> some View {
        modifier(ComposerGlassSurface(cornerRadius: cornerRadius))
    }
}
