import Foundation

public enum CloudAgentStatus: String, Codable, Hashable, Sendable {
    case queued, running, completed, failed, cancelled, expired

    public var isActive: Bool { self == .queued || self == .running }
}

public struct CloudAgentWork: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let agentId: String
    public let chatId: String
    public let messageId: String
    public let provider: String
    public let providerUrl: String?
    public let repository: String
    public let startingRef: String?
    public let title: String
    public let status: CloudAgentStatus
    public let createdAt: Date
    public let updatedAt: Date
    public let startedAt: Date?
    public let terminalAt: Date?
    public let cancelRequestedAt: Date?
    public let activity: CloudAgentActivity?
    public let runs: [CloudAgentRun]
}

public struct CloudAgentActivity: Codable, Hashable, Sendable {
    public let at: Date
    public let summary: String
}

public struct CloudAgentRun: Codable, Hashable, Sendable {
    public let runId: String
    public let status: CloudAgentStatus
    public let branches: [CloudAgentBranch]
    public let startedAt: Date?
    public let terminalAt: Date?
    public let summary: String?
    public let errorCode: String?
}

public struct CloudAgentBranch: Codable, Hashable, Sendable {
    public let branch: String
    public let repository: String
    public let pullRequestUrl: String?
    public let pullRequest: CloudAgentPullRequest?
}

public struct CloudAgentPullRequest: Codable, Hashable, Sendable {
    public let additions: Int
    public let changedFiles: Int
    public let deletions: Int
    public let number: Int
    public let state: String
    public let observedAt: Date
}

public struct ThreadCloudAgentWork: Codable, Hashable, Sendable {
    public let anchorMessageId: String
    public let work: CloudAgentWork
}

public struct CloudAgentCapability: Codable, Hashable, Sendable {
    public let ready: Bool
    public let accountEmail: String?
    public let reason: String?
    public let expiresAt: Date?
}
