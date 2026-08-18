import SwiftUI

/// Transient connection chrome shared by messaging surfaces.
struct ConnectionStatusBanner: View {
    var body: some View {
        Group {
            if #available(iOS 26, macOS 26, *) {
                content
                    .glassEffect(.regular, in: .rect(cornerRadius: 18))
            } else {
                content
                    .background(.thinMaterial, in: .rect(cornerRadius: 18))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Reconnecting to Grotto")
    }

    private var content: some View {
        HStack(spacing: 10) {
            ProgressView()
                .controlSize(.small)

            Text("Reconnecting…")
                .font(.callout.weight(.medium))

            Spacer(minLength: 0)
        }
        .foregroundStyle(.secondary)
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, minHeight: 42, alignment: .leading)
    }
}
