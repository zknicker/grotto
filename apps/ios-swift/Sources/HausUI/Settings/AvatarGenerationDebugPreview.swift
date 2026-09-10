#if DEBUG && os(iOS)
import Foundation
import SwiftUI
import UIKit

/// The avatar surfaces a screenshot can reach without a Server.
///
/// Generation is a paid, authenticated, tens-of-seconds operation, so its
/// states are unreachable in a normal Simulator run. Each scene mounts the
/// production view with fixed inputs.
public enum AvatarGenerationDebugScene: String, CaseIterable, Sendable {
    case generator = "--avatar-generation-preview"
    case generatorFilled = "--avatar-generation-preview-filled"
    case generatorProgress = "--avatar-generation-preview-progress"
    /// The Agent profile that opens the generator.
    case profile = "--avatar-generation-preview-profile"
    /// The same profile for a factory Agent, which offers no generator.
    case factoryProfile = "--avatar-generation-preview-factory-profile"

    public static func resolve(_ arguments: [String]) -> AvatarGenerationDebugScene? {
        arguments.lazy.compactMap(AvatarGenerationDebugScene.init(rawValue:)).first
    }
}

/// Deterministic screenshot host. It exercises the production avatar UI without
/// authenticating or calling the paid image provider.
public struct AvatarGenerationDebugPreview: View {
    private let scene: AvatarGenerationDebugScene

    public init(scene: AvatarGenerationDebugScene) {
        self.scene = scene
    }

    public var body: some View {
        switch scene {
        case .profile:
            profile(SettingsFixtures.blippy)
        case .factoryProfile:
            profile(SettingsFixtures.cove)
        case .generator, .generatorFilled, .generatorProgress:
            generator
        }
    }

    private var generator: some View {
        AgentAvatarGenerationView(
            agentName: "Blippy",
            onGenerate: { _ in
                try await Task.sleep(for: .seconds(5))
                return AvatarImagePayload(data: debugAvatarData(), mediaType: .png)
            },
            onSave: { _ in },
            initialConcept: scene == .generator ? "" : "a moonlit fox cartographer",
            initialPreview: scene == .generatorFilled
                ? AvatarImagePayload(data: debugAvatarData(), mediaType: .png)
                : nil,
            initiallyGenerating: scene == .generatorProgress
        )
    }

    private func profile(_ agent: SettingsAgent) -> some View {
        NavigationStack {
            AgentProfileView(agent: agent, onEditDescription: { _, _ in })
        }
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
