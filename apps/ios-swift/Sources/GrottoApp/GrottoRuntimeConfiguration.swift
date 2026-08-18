import Foundation

enum GrottoRuntimeConfiguration {
    struct Development {
        let clerkPublishableKey: String
        let serverOrigin: URL
    }

    private static let productionClerkPublishableKey = "pk_live_Y2xlcmsuZ3JvdHRvLnNoJA"
    private static let productionServerOrigin = URL(string: "https://grotto.sh")!
    private static let cachedClerkPublishableKey = "grotto.debug.clerk-publishable-key"
    private static let cachedServerOrigin = "grotto.debug.server-origin"

    static var development: Development? {
        #if DEBUG
        let environment = ProcessInfo.processInfo.environment
        if let configured = validatedDevelopment(
            clerkPublishableKey: environment["GROTTO_CLERK_PUBLISHABLE_KEY"],
            serverOrigin: environment["GROTTO_DEV_SERVER_ORIGIN"]
        ) {
            cache(configured)
            return configured
        }

        let defaults = UserDefaults.standard
        return validatedDevelopment(
            clerkPublishableKey: defaults.string(forKey: cachedClerkPublishableKey),
            serverOrigin: defaults.string(forKey: cachedServerOrigin)
        )
        #else
        nil
        #endif
    }

    static var clerkPublishableKey: String {
        development?.clerkPublishableKey ?? productionClerkPublishableKey
    }

    static var serverOrigin: URL {
        development?.serverOrigin ?? productionServerOrigin
    }

    #if DEBUG
    private static func validatedDevelopment(
        clerkPublishableKey: String?,
        serverOrigin: String?
    ) -> Development? {
        guard let clerkPublishableKey,
              !clerkPublishableKey.isEmpty,
              let serverOrigin = serverOrigin.flatMap(URL.init(string:)),
              serverOrigin.scheme == "http",
              let serverHost = serverOrigin.host,
              ["localhost", "127.0.0.1", "::1"].contains(serverHost)
        else { return nil }
        return Development(
            clerkPublishableKey: clerkPublishableKey,
            serverOrigin: serverOrigin
        )
    }

    private static func cache(_ development: Development) {
        let defaults = UserDefaults.standard
        defaults.set(development.clerkPublishableKey, forKey: cachedClerkPublishableKey)
        defaults.set(development.serverOrigin.absoluteString, forKey: cachedServerOrigin)
    }
    #endif
}
