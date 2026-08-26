#if DEBUG && os(iOS)
import Foundation
import SwiftUI
import UIKit

/// Deterministic screenshot host. It exercises the production generation UI
/// without authenticating or calling the paid image provider.
public struct AvatarGenerationDebugPreview: View {
    public init() {}

    public var body: some View {
        let arguments = ProcessInfo.processInfo.arguments
        let filled = arguments.contains("--avatar-generation-preview-filled")
        let progress = arguments.contains("--avatar-generation-preview-progress")
        AgentAvatarGenerationView(
            agentName: "Blippy",
            onGenerate: { _ in
                try await Task.sleep(for: .seconds(5))
                return AvatarImagePayload(data: debugAvatarData(), mediaType: .png)
            },
            onSave: { _ in },
            initialConcept: filled || progress ? "a moonlit fox cartographer" : "",
            initialPreview: filled
                ? AvatarImagePayload(data: debugAvatarData(), mediaType: .png)
                : nil,
            initiallyGenerating: progress
        )
    }
}

private func debugAvatarData() -> Data {
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: 256, height: 256))
    return renderer.pngData { context in
        UIColor.systemIndigo.setFill()
        context.fill(CGRect(x: 0, y: 0, width: 256, height: 256))
        let image = UIImage(systemName: "sparkles")?.withTintColor(.white, renderingMode: .alwaysOriginal)
        image?.draw(in: CGRect(x: 64, y: 64, width: 128, height: 128))
    }
}
#endif
