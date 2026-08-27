import ClerkKit
import Foundation
import GrottoUI
import SwiftUI

@main
struct GrottoApp: App {
    init() {
        Clerk.configure(
            publishableKey: GrottoRuntimeConfiguration.clerkPublishableKey,
            options: .init(
                redirectConfig: .init(
                    redirectUrl: "grotto://sso-callback",
                    callbackUrlScheme: "grotto"
                )
            )
        )
    }

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if let scene = AvatarGenerationDebugScene.resolve(ProcessInfo.processInfo.arguments) {
                AvatarGenerationDebugPreview(scene: scene)
            } else {
                AuthBoundaryView()
                    .environment(Clerk.shared)
            }
            #else
            AuthBoundaryView()
                .environment(Clerk.shared)
            #endif
        }
    }
}
