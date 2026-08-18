import Foundation

/// The localhost-only response used to authenticate Debug builds without a
/// browser round trip. The Server owns ticket creation and its safety checks.
public struct DevClerkSignInTicket: Decodable, Equatable, Sendable {
    public let ticket: String

    public init(ticket: String) {
        self.ticket = ticket
    }
}

public extension TRPCClient {
    func createDevClerkSignInTicket() async throws -> DevClerkSignInTicket {
        try await mutation(
            "dev.createClerkSignInToken",
            input: DevClerkSignInTicketInput()
        )
    }
}

private struct DevClerkSignInTicketInput: Encodable {}
