import SwiftUI

/// The composer's glass shell.
///
/// Over a white transcript a tinted glass fill is very nearly white, and making the fill greyer is
/// off the table — that is what turns a glass composer into ChatGPT's flat grey slab. Definition
/// comes from the edge instead: a specular rim that is brightest along the top and fades down the
/// sides the way light falls on a real pane, a tight contact shadow that separates the shell from
/// the paper, and a soft ambient shadow that lifts it. The transcript scrolls underneath, so the
/// glass also has live content to refract.
struct ComposerGlassSurface: ViewModifier {
    let cornerRadius: CGFloat

    /// Specular rim light: top-lit, so the highlight rides the top edge and is gone by the middle.
    /// It must fade — a uniform white rim was the original bug, painting a white line exactly where
    /// the fill met the white page and dissolving the silhouette it was supposed to draw.
    static let specular = LinearGradient(
        stops: [
            .init(color: .white.opacity(0.9), location: 0),
            .init(color: .white.opacity(0.3), location: 0.3),
            .init(color: .white.opacity(0), location: 0.55),
        ],
        startPoint: .top,
        endPoint: .bottom
    )

    func body(content: Content) -> some View {
        fill(content)
            // The contour carries the silhouette everywhere the specular does not, and follows the
            // scheme: a dark hairline on paper, a light one in the dark. Explicit label colour, not
            // hierarchical `.primary` — glass vibrancy dissolves hierarchical styles to nothing.
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(GrottoPlatformColor.label.opacity(0.1), lineWidth: 1)
            }
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(Self.specular, lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.06), radius: 1.5, y: 1)
            .shadow(color: .black.opacity(0.05), radius: 20, y: 8)
    }

    @ViewBuilder
    private func fill(_ content: Content) -> some View {
        if #available(iOS 26, macOS 26, *) {
            content.glassEffect(
                .regular.tint(Color.primary.opacity(0.04)).interactive(),
                in: .rect(cornerRadius: cornerRadius)
            )
        } else {
            // The pre-26 path gets its visibility from the same rim and lift, not from a darker
            // fill, so both paths read as the same component.
            content.background(.ultraThinMaterial, in: .rect(cornerRadius: cornerRadius))
        }
    }
}

extension View {
    func composerGlassSurface(cornerRadius: CGFloat) -> some View {
        modifier(ComposerGlassSurface(cornerRadius: cornerRadius))
    }
}
