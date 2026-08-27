import SwiftUI

/// The composer's glass shell.
///
/// Liquid Glass draws its own edge and its own shadow, and it derives both from the scheme and
/// from the content refracting through it. Everything this modifier adds on top of the material is
/// therefore a compensation for one specific shortfall, and each one is scoped to the case that
/// needs it:
///
/// - The material separates itself from a dark transcript, but over the near-white transcript in
///   light mode its rim has almost nothing to lens and the shell dissolves into the page. A single
///   uniform hairline in the label colour restores the contour. It is the whole compensation: no
///   painted specular, because the material already lights its own top edge, and a hand-rolled
///   highlight both double-draws that edge and — being literal white — reads as a stark white line
///   across the top in dark mode, where the material needed no help at all.
/// - The pre-26 fallback has no self-generated rim in either scheme, so the same hairline carries
///   the silhouette there and the two paths read as one component.
///
/// The shell is deliberately not `interactive()`. That flourish is Liquid Glass's response for
/// *controls* — a press-driven bloom that brightens the fill and flexes the shape past its own
/// bounds. On a full-width container tapped to move focus it fired on every tap, blooming the fill
/// out beyond the hairline while the hairline stayed put. Interactivity belongs to the plus and the
/// send circle inside the shell, not to the shell.
struct ComposerGlassSurface: ViewModifier {
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        fill(content)
            // Explicit label colour, not hierarchical `.primary` — glass vibrancy dissolves
            // hierarchical styles to nothing.
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(GrottoPlatformColor.label.opacity(0.1), lineWidth: 1)
            }
    }

    @ViewBuilder
    private func fill(_ content: Content) -> some View {
        if #available(iOS 26, macOS 26, *) {
            // Untinted. A tint is what turns a glass composer into ChatGPT's flat grey slab, and
            // `.primary` in particular is the style glass vibrancy is most likely to wash out.
            content.glassEffect(.regular, in: .rect(cornerRadius: cornerRadius))
        } else {
            content.background(.ultraThinMaterial, in: .rect(cornerRadius: cornerRadius))
        }
    }
}

extension View {
    func composerGlassSurface(cornerRadius: CGFloat) -> some View {
        modifier(ComposerGlassSurface(cornerRadius: cornerRadius))
    }
}
