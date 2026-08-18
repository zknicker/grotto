import SwiftUI

/// Placeholder for the isolated HTML renderer.
///
/// A production adapter can replace this view with a sandboxed `WKWebView`
/// while keeping `ArtifactWebCanvasContract` as its only native input. The
/// adapter must fetch the confined workspace file and inject host theme
/// tokens; it must not receive app navigation, auth, or Server state.
public struct ArtifactWebCanvasPlaceholder: View {
    public let contract: ArtifactWebCanvasContract

    public init(contract: ArtifactWebCanvasContract) {
        self.contract = contract
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Isolated web canvas", systemImage: "safari")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)

            Text("Interactive HTML content will render here without sharing native app state.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Text(contract.path)
                .font(.caption.monospaced())
                .foregroundStyle(.tertiary)
                .lineLimit(2)
                .truncationMode(.middle)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(GrottoPlatformColor.inputSurface, in: .rect(cornerRadius: 14))
        .overlay {
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(.separator.opacity(0.7), lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Isolated web canvas for \(contract.title ?? contract.path)")
    }
}

#Preview("Web canvas contract") {
    ArtifactWebCanvasPlaceholder(
        contract: ArtifactFixtures.architectureBrief.webCanvasContract
    )
    .padding()
    .background(GrottoPlatformColor.groupedBackground)
}
