import SwiftUI

/// The single circular icon control for app chrome.
///
/// Every floating or header chrome control renders through this view, so the
/// circle, glyph metrics, and glass treatment stay identical on every screen.
/// Callers choose a glyph and a label; they never restyle the control.
struct GlassChromeButton: View {
    enum Glyph {
        case symbol(String)
        case sidebar
    }

    static let diameter: CGFloat = 44
    static let glyphPointSize: CGFloat = 19

    private let glyph: Glyph
    private let label: String
    private let action: () -> Void

    init(_ glyph: Glyph, label: String, action: @escaping () -> Void) {
        self.glyph = glyph
        self.label = label
        self.action = action
    }

    @ViewBuilder
    var body: some View {
        if #available(iOS 26, macOS 26, *) {
            standardButton
                .glassEffect(.regular.interactive(), in: .circle)
        } else {
            standardButton
                .background(.regularMaterial, in: .circle)
        }
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
        case .symbol(let name):
            Image(systemName: name)
                .font(.system(size: Self.glyphPointSize, weight: .medium))
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
        GlassChromeButton(.symbol("magnifyingglass"), label: "Search messages") {}
        GlassChromeButton(.symbol("xmark"), label: "Close settings") {}
        GlassChromeButton(.symbol("chevron.left"), label: "Back") {}
    }
    .padding()
}
