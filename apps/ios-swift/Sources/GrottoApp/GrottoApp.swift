import ClerkKit
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
            AuthBoundaryView()
                .environment(Clerk.shared)
        }
    }
}
