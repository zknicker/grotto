import SwiftUI

/// The single circular icon control for app chrome.
///
/// Every floating or header chrome control renders through this view, so the
/// circle, glyph metrics, and glass treatment stay identical on every screen.
/// Callers choose a glyph and a label; they never restyle the control.
struct GlassChromeButton: View {
    enum Glyph {
        case icon(GrottoIconName)
        case sidebar
    }

    static let diameter: CGFloat = 44
    static let iconGlyphSize: CGFloat = 22
    /// The stroke-rounded family draws at 1.5 on its 24pt grid, which reads
    /// thin at chrome size against a glass circle.
    static let iconGlyphWeight: CGFloat = 2

    private let glyph: Glyph
    private let label: String
    private let action: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    init(_ glyph: Glyph, label: String, action: @escaping () -> Void) {
        self.glyph = glyph
        self.label = label
        self.action = action
    }

    private var rimColor: Color {
        colorScheme == .dark ? .white.opacity(0.14) : .white.opacity(0.75)
    }

    private var shadowColor: Color {
        .black.opacity(colorScheme == .dark ? 0.40 : 0.10)
    }

    @ViewBuilder
    var body: some View {
        if #available(iOS 26, macOS 26, *) {
            // Liquid Glass owns the whole press treatment: it lights, lifts,
            // and settles the circle itself. A rim stroke or shadow layered
            // over it does not move with that morph, so the press left the
            // stroke stranded inside a grown circle and the shadow pinned to
            // the resting size. Nothing is drawn around the glass here.
            glassButton
        } else {
            // Pre-26 `.regularMaterial` has neither an edge nor a lift of its
            // own, so the fallback still draws both — and the plain button
            // style below leaves the material static under a press.
            standardButton
                .background(.regularMaterial, in: .circle)
                .overlay(Circle().strokeBorder(rimColor, lineWidth: 1))
                .shadow(color: shadowColor, radius: 8, x: 0, y: 2)
        }
    }

    /// The glass button style owns its own padding, so the label is inset by
    /// that amount to land the drawn circle back on the shared `diameter`.
    /// Measured against the style, not guessed: a `diameter`-sized label came
    /// out at `diameter + glassButtonInset * 2`.
    private static let glassButtonInset: CGFloat = 7

    @available(iOS 26, macOS 26, *)
    private var glassButton: some View {
        Button(action: action) {
            glyphContent
                .frame(
                    width: Self.diameter - Self.glassButtonInset * 2,
                    height: Self.diameter - Self.glassButtonInset * 2
                )
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.circle)
        .foregroundStyle(GrottoPlatformColor.label)
        .fixedSize()
        .accessibilityLabel(label)
    }

    private var standardButton: some View {
        Button(action: action) {
            glyphContent
                .frame(width: Self.diameter, height: Self.diameter)
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .foregroundStyle(GrottoPlatformColor.label)
        .frame(width: Self.diameter, height: Self.diameter)
        .fixedSize()
        .accessibilityLabel(label)
    }

    @ViewBuilder
    private var glyphContent: some View {
        switch glyph {
        case .icon(let name):
            GrottoIcon(name, size: Self.iconGlyphSize, weight: Self.iconGlyphWeight)
        case .sidebar:
            SidebarMenuGlyph()
        }
    }
}

private struct SidebarMenuGlyph: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Capsule().fill(GrottoPlatformColor.label).frame(width: 21, height: 2.5)
            Capsule().fill(GrottoPlatformColor.label).frame(width: 14, height: 2.5)
        }
        .accessibilityHidden(true)
    }
}

#Preview {
    HStack(spacing: 16) {
        GlassChromeButton(.sidebar, label: "Open navigation") {}
        GlassChromeButton(.icon(.search), label: "Search messages") {}
        GlassChromeButton(.icon(.close), label: "Close settings") {}
        GlassChromeButton(.icon(.settings), label: "Settings") {}
    }
    .padding()
}
