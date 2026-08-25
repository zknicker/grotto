import SwiftUI

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

enum GrottoPlatformColor {
    static var label: Color {
        #if canImport(UIKit)
        Color(uiColor: .label)
        #else
        Color(nsColor: .labelColor)
        #endif
    }

    static var secondaryLabel: Color {
        #if canImport(UIKit)
        Color(uiColor: .secondaryLabel)
        #else
        Color(nsColor: .secondaryLabelColor)
        #endif
    }

    static var background: Color {
        #if canImport(UIKit)
        Color(uiColor: .systemBackground)
        #else
        Color(nsColor: .windowBackgroundColor)
        #endif
    }

    static var groupedBackground: Color {
        #if canImport(UIKit)
        Color(uiColor: .systemGroupedBackground)
        #else
        Color(nsColor: .windowBackgroundColor)
        #endif
    }

    static var groupedSurface: Color {
        #if canImport(UIKit)
        Color(uiColor: .secondarySystemGroupedBackground)
        #else
        Color(nsColor: .controlBackgroundColor)
        #endif
    }

    static var inputSurface: Color {
        #if canImport(UIKit)
        Color(uiColor: .tertiarySystemFill)
        #else
        Color(nsColor: .controlBackgroundColor)
        #endif
    }

    /// Opaque grey for a disabled round control, so glass vibrancy cannot dissolve it.
    static var disabledControlFill: Color {
        #if canImport(UIKit)
        Color(uiColor: .systemGray3)
        #else
        Color(nsColor: .disabledControlTextColor)
        #endif
    }
}

extension View {
    @ViewBuilder
    func grottoInlineNavigationTitle() -> some View {
        #if os(iOS)
        navigationBarTitleDisplayMode(.inline)
        #else
        self
        #endif
    }

    /// Sets the gap between list sections for a Linear-like rhythm.
    ///
    /// The Tasks list rules its section boundaries, so this only has to keep the
    /// last row of a group off that rule; Linear's groups sit close to the line.
    @ViewBuilder
    func grottoCompactListSections() -> some View {
        #if os(iOS)
        listSectionSpacing(10)
        #else
        self
        #endif
    }

    @ViewBuilder
    func grottoWordsAutocapitalization() -> some View {
        #if os(iOS)
        textInputAutocapitalization(.words)
        #else
        self
        #endif
    }

    @ViewBuilder
    func grottoHandleInput() -> some View {
        #if os(iOS)
        textInputAutocapitalization(.never)
            .autocorrectionDisabled()
        #else
        self
        #endif
    }
}

public extension View {
    /// Hides the system navigation bar on a screen that supplies its own ``ChromeHeader``.
    @ViewBuilder
    func grottoHiddenNavigationBar() -> some View {
        #if os(iOS)
        toolbar(.hidden, for: .navigationBar)
        #else
        self
        #endif
    }
}

/// The veil painted over the Chat canvas while the sidebar drawer is open.
///
/// Light mode fades the canvas toward the background and reads its edge from the
/// canvas shadow. Dark mode cannot: a darker veil would erase the edge between a
/// black canvas and a black sidebar, so the canvas lifts to an elevated surface
/// instead.
enum GrottoDrawerVeil {
    static func color(for scheme: ColorScheme) -> Color {
        scheme == .dark ? .white : GrottoPlatformColor.background
    }

    static func opacity(for scheme: ColorScheme, progress: CGFloat) -> Double {
        Double(progress) * (scheme == .dark ? 0.11 : 0.55)
    }
}
