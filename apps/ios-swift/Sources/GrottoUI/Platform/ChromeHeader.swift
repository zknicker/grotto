import SwiftUI

enum GrottoChrome {
    /// Every chrome row is this tall, so a chrome button in the sidebar and one
    /// on the Chat canvas land on the same centerline.
    static let headerHeight: CGFloat = 56

    /// Extra bar region below the chrome row, reserved purely as runway for the
    /// system's scroll edge effect.
    ///
    /// The effect has no strength: the public surface is three named styles, and
    /// `.hard` is an opaque cap with a dividing line rather than a deeper fade.
    /// What it does have is reach — iOS 26 ramps the dissolve across the bar
    /// region it was given, so a taller bar is a longer ramp. Over the chrome row
    /// alone the ramp is barely a line tall and a passing row stays readable
    /// under the header; this much runway takes that row down to roughly a
    /// seventh of its contrast while leaving the first row below the chrome
    /// fully crisp. More runway starts softening that row too, which is the
    /// wrong trade — the point is a decisive dissolve, not a taller cap.
    static let scrollEdgeRunway: CGFloat = 28
}

/// The shared app-chrome header row.
///
/// Chat and Settings place their chrome buttons through this row so leading,
/// centered, and trailing chrome share one height and one inset on every screen.
struct ChromeHeader<Leading: View, Center: View, Trailing: View>: View {
    private let inset: CGFloat
    @ViewBuilder private let leading: () -> Leading
    @ViewBuilder private let center: () -> Center
    @ViewBuilder private let trailing: () -> Trailing

    init(
        inset: CGFloat = 16,
        @ViewBuilder leading: @escaping () -> Leading,
        @ViewBuilder center: @escaping () -> Center,
        @ViewBuilder trailing: @escaping () -> Trailing
    ) {
        self.inset = inset
        self.leading = leading
        self.center = center
        self.trailing = trailing
    }

    var body: some View {
        ZStack {
            center()

            HStack(spacing: 12) {
                leading()
                Spacer(minLength: 12)
                trailing()
            }
        }
        .padding(.horizontal, inset)
        .frame(height: GrottoChrome.headerHeight)
    }
}

extension View {
    /// Attaches floating chrome to a scrolling view's edge as a *bar*.
    ///
    /// iOS 26 paints its scroll edge effect only behind content the scroll view
    /// knows is a bar. `safeAreaInset` reserves the room without claiming it, so
    /// `scrollEdgeEffectStyle` had no region to soften: the transcript ran
    /// razor-sharp into the status bar and the glass header sat over raw text.
    /// `safeAreaBar` reserves the same room and marks it, which is what puts the
    /// scrim back under the chrome.
    ///
    /// The bar is also deliberately taller than the chrome it carries, because
    /// the region is what sets how far the dissolve ramps —
    /// ``GrottoChrome/scrollEdgeRunway`` explains the trade. Pre-26 has no edge
    /// effect at all, so it gets neither the bar nor the runway: there the plain
    /// inset is the whole behavior and the extra room would only be dead space.
    @ViewBuilder
    func chromeBar<Content: View>(
        edge: VerticalEdge,
        spacing: CGFloat? = nil,
        @ViewBuilder content: () -> Content
    ) -> some View {
        if #available(iOS 26, macOS 26, *) {
            safeAreaBar(edge: edge, spacing: spacing) {
                content().padding(edge == .top ? .bottom : .top, GrottoChrome.scrollEdgeRunway)
            }
        } else {
            safeAreaInset(edge: edge, spacing: spacing, content: content)
        }
    }
}

extension View {
    /// The transcript's soft top edge: rows dissolve as they pass under the
    /// chrome, the way the system scroll edge effect painted for a SwiftUI
    /// scroll view. The system effect computes its region from safe areas the
    /// flipped transcript table does not have, so the dissolve is a mask —
    /// same ramp shape as the iOS 26 soft edge, on every iOS version. Rows
    /// are crisp below the bar, at roughly a seventh of their contrast behind
    /// the chrome row, and gone by the status bar.
    ///
    /// `safeAreaTop` is the full reserved top region: status bar, chrome row,
    /// and runway.
    func transcriptTopDissolve(safeAreaTop: CGFloat) -> some View {
        mask {
            VStack(spacing: 0) {
                LinearGradient(
                    stops: [
                        .init(color: .black.opacity(0), location: 0),
                        .init(color: .black.opacity(0.05), location: 0.4),
                        .init(color: .black.opacity(0.15), location: 0.8),
                        .init(color: .black, location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: safeAreaTop)
                Color.black
            }
            .ignoresSafeArea()
        }
    }
}

extension ChromeHeader where Center == EmptyView {
    init(
        inset: CGFloat = 16,
        @ViewBuilder leading: @escaping () -> Leading,
        @ViewBuilder trailing: @escaping () -> Trailing
    ) {
        self.init(inset: inset, leading: leading, center: { EmptyView() }, trailing: trailing)
    }
}
