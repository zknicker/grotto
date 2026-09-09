import Foundation

/// The Agent an `agent-created` Message brought into being.
///
/// The Server projects the live Agent row onto the Message that created it, so
/// this is the Agent as it is now — a renamed or retired Agent reads as itself
/// rather than as the record it was created from. Agents are retired, never
/// hard-deleted, so the projection is always present.
public struct CreatedAgentSummary: Codable, Sendable, Equatable {
    public let agentID: String
    public let avatarURL: String?
    public let description: String?
    public let displayName: String
    public let handle: String
    public let retired: Bool

    public init(
        agentID: String,
        avatarURL: String?,
        description: String?,
        displayName: String,
        handle: String,
        retired: Bool
    ) {
        self.agentID = agentID
        self.avatarURL = avatarURL
        self.description = description
        self.displayName = displayName
        self.handle = handle
        self.retired = retired
    }

    enum CodingKeys: String, CodingKey {
        case agentID = "agentId"
        case avatarURL = "avatarUrl"
        case description
        case displayName
        case handle
        case retired
    }
}
