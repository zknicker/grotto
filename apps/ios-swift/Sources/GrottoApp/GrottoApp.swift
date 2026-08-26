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
            if ProcessInfo.processInfo.arguments.contains(where: {
                $0 == "--avatar-generation-preview"
                    || $0 == "--avatar-generation-preview-filled"
                    || $0 == "--avatar-generation-preview-progress"
            }) {
                AvatarGenerationDebugPreview()
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
