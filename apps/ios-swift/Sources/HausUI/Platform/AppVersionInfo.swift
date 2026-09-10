import Foundation

/// The app's marketing version and build number, formatted for display.
enum AppVersionInfo {
    static var current: String {
        formatted(
            shortVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
            build: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
        )
    }

    /// Pure formatting so the "1.8.19 (123)" shape is testable without a bundle.
    static func formatted(shortVersion: String?, build: String?) -> String {
        let version = (shortVersion?.isEmpty == false) ? shortVersion! : "Unknown"
        guard let build, !build.isEmpty else { return version }
        return "\(version) (\(build))"
    }
}
