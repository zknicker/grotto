import SwiftUI

enum GrottoChrome {
    /// Every chrome row is this tall, so a chrome button in the sidebar and one
    /// on the Chat canvas land on the same centerline.
    static let headerHeight: CGFloat = 56
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

extension ChromeHeader where Center == EmptyView {
    init(
        inset: CGFloat = 16,
        @ViewBuilder leading: @escaping () -> Leading,
        @ViewBuilder trailing: @escaping () -> Trailing
    ) {
        self.init(inset: inset, leading: leading, center: { EmptyView() }, trailing: trailing)
    }
}
