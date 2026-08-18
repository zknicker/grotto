import Foundation

/// The presentation slice needed to open one durable workspace artifact.
///
/// Artifact content is intentionally not loaded here. The Server/Computer
/// boundary owns the authenticated workspace read; this value only crosses
/// from the native route into the isolated web canvas.
public struct ArtifactPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let path: String
    public let title: String?

    public init(id: String, path: String, title: String? = nil) {
        self.id = id
        self.path = path
        self.title = title
    }

    /// The title shown in native chrome and tab-like surfaces.
    public var displayTitle: String {
        if let title {
            let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                return trimmed
            }
        }

        return fileName.isEmpty ? "Artifact" : fileName
    }

    /// The final path component used when an artifact has no explicit title.
    public var fileName: String {
        path.split(separator: "/", omittingEmptySubsequences: true).last.map(String.init) ?? ""
    }

    public var webCanvasContract: ArtifactWebCanvasContract {
        ArtifactWebCanvasContract(path: path, title: title)
    }
}

/// Narrow input for the browser-required artifact renderer.
///
/// This mirrors the web `artifact` fence payload (`path` plus optional
/// `title`). It deliberately contains no authentication token, navigation
/// callback, Server query, or durable app state.
public struct ArtifactWebCanvasContract: Codable, Hashable, Sendable {
    public let path: String
    public let title: String?

    private enum CodingKeys: String, CodingKey {
        case path
        case title
    }

    public init(path: String, title: String? = nil) {
        self.path = path
        self.title = title
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        path = try container.decode(String.self, forKey: .path)
        title = try container.decodeIfPresent(String.self, forKey: .title)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(path, forKey: .path)
        try container.encodeIfPresent(title, forKey: .title)
    }
}

public enum ArtifactFixtures {
    public static let architectureBrief = ArtifactPresentation(
        id: "artifact-ios-architecture-brief",
        path: "workbench/ios-architecture-brief.html",
        title: "iOS architecture brief"
    )
}
