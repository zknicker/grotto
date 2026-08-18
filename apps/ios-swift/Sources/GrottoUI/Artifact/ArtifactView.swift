import SwiftUI

/// Native route chrome and summary for a durable workspace artifact.
///
/// The default initializer presents the isolated web-canvas placeholder. A
/// host that has a browser adapter can inject its canvas with the trailing
/// `canvasContent` builder without changing the native shell.
public struct ArtifactView<CanvasContent: View>: View {
    private let artifact: ArtifactPresentation
    private let onBack: () -> Void
    private let canvasContent: () -> CanvasContent

    public init(
        artifact: ArtifactPresentation,
        onBack: @escaping () -> Void,
        @ViewBuilder canvasContent: @escaping () -> CanvasContent
    ) {
        self.artifact = artifact
        self.onBack = onBack
        self.canvasContent = canvasContent
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 16) {
                    summaryCard
                    canvasContent()
                }
                .padding(16)
            }
            .scrollIndicators(.hidden)
        }
        .background(GrottoPlatformColor.groupedBackground)
    }

    private var header: some View {
        HStack(spacing: 10) {
            GlassChromeButton(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .semibold))
            }
            .accessibilityLabel("Back")

            Text(artifact.displayTitle)
                .font(.headline)
                .lineLimit(1)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .frame(height: 54)
        .background(.background)
    }

    private var summaryCard: some View {
        VStack(spacing: 0) {
            VStack(spacing: 12) {
                Image(systemName: "doc.text")
                    .font(.system(size: 26, weight: .medium))
                    .foregroundStyle(.tint)
                    .frame(width: 56, height: 56)
                    .background(Color.accentColor.opacity(0.12), in: .rect(cornerRadius: 16))

                Text("Native artifact route")
                    .font(.title3.weight(.semibold))
                    .multilineTextAlignment(.center)

                Text("The route and controls remain native. Interactive artifact content will mount in an isolated web canvas here.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 24)
            .padding(.vertical, 28)
        }
        .background(GrottoPlatformColor.groupedSurface, in: .rect(cornerRadius: 18))
        .overlay {
            RoundedRectangle(cornerRadius: 18)
                .strokeBorder(.separator.opacity(0.55), lineWidth: 1)
        }
    }
}

public extension ArtifactView where CanvasContent == ArtifactWebCanvasPlaceholder {
    init(artifact: ArtifactPresentation, onBack: @escaping () -> Void) {
        self.init(artifact: artifact, onBack: onBack) {
            ArtifactWebCanvasPlaceholder(contract: artifact.webCanvasContract)
        }
    }
}

#Preview("Artifact route") {
    ArtifactView(artifact: ArtifactFixtures.architectureBrief, onBack: {})
}
