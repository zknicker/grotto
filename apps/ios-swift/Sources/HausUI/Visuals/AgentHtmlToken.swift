import Foundation

/// One CSS custom property handed to agent-authored HTML.
public struct AgentHtmlToken: Sendable, Hashable {
    public let name: String
    public let value: String

    public init(name: String, value: String) {
        self.name = name
        self.value = value
    }
}

public extension AgentHtmlTokens {
    /// The table for a color scheme, in published order.
    static func table(for scheme: AgentHtmlColorScheme) -> [AgentHtmlToken] {
        switch scheme {
        case .dark: dark
        case .light: light
        }
    }
}

public enum AgentHtmlColorScheme: String, Sendable {
    case dark
    case light
}
