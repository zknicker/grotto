import GrottoModels
import GrottoTransport
import OSLog

private let computerLogger = Logger(subsystem: "build.grotto.ios", category: "computers")

extension GrottoStore {
    /// Computer visibility is role-gated by the Server. A denied or temporarily
    /// unavailable query must not make the rest of the native app fail to load.
    func loadComputers(serverID: String) async {
        do {
            let loaded: [ComputerSummary] = try await client.query(
                "computer.list",
                input: ServerScopedInput(serverId: serverID)
            )
            computers = loaded
        } catch {
            computers = nil
            computerLogger.debug("Computer snapshot unavailable: \(error.localizedDescription, privacy: .public)")
        }
    }
}
