import Foundation

/// The headers that gate the App ↔ Server wire contract.
public enum GrottoAppProtocol {
    public static let version = 4
    public static let productVersionHeader = "x-grotto-product-version"
    public static let protocolVersionHeader = "x-grotto-app-protocol-version"
}

/// Configuration shared by every native request to Grotto Server.
public struct AppConfig: Equatable, Sendable {
    public let serverOrigin: URL
    public let productVersion: String
    public let appProtocolVersion: Int

    public init(
        serverOrigin: URL,
        productVersion: String,
        appProtocolVersion: Int = GrottoAppProtocol.version
    ) {
        self.serverOrigin = serverOrigin
        self.productVersion = productVersion
        self.appProtocolVersion = appProtocolVersion
    }

    public var trpcURL: URL {
        serverOrigin.appendingPathComponent("trpc", isDirectory: false)
    }

    public func headers(sessionToken: String?) -> [String: String] {
        var headers = [
            GrottoAppProtocol.productVersionHeader: productVersion,
            GrottoAppProtocol.protocolVersionHeader: String(appProtocolVersion),
        ]
        if let sessionToken, !sessionToken.isEmpty {
            headers["authorization"] = "Bearer \(sessionToken)"
        }
        return headers
    }
}
