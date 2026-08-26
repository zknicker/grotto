import Foundation
@testable import GrottoUI
import Testing

@MainActor
struct ComposerInteractionTests {
    /// Regression: cleanUp used to delete the staged files but keep the
    /// `attachments` array, leaving dead tiles whose sends could only fail.
    @Test func cleanUpLeavesNoAttachmentBehind() throws {
        let interaction = ComposerInteraction()
        let first = try Self.stageTemporaryFile(named: "notes.txt")
        let second = try Self.stageTemporaryFile(named: "report.txt")
        interaction.appendPrepared([first, second])
        #expect(interaction.attachments.count == 2)

        interaction.cleanUp()

        #expect(interaction.attachments.isEmpty)
        #expect(!FileManager.default.fileExists(atPath: first.localURL.path))
        #expect(!FileManager.default.fileExists(atPath: second.localURL.path))
    }

    @Test func cleanUpAfterRemoveLeavesNoAttachmentWithAMissingFile() throws {
        let interaction = ComposerInteraction()
        let staged = try Self.stageTemporaryFile(named: "notes.txt")
        interaction.appendPrepared([staged])
        interaction.remove(staged)
        interaction.cleanUp()

        let dead = interaction.attachments.filter {
            !FileManager.default.fileExists(atPath: $0.localURL.path)
        }
        #expect(dead.isEmpty)
        #expect(interaction.attachments.isEmpty)
    }

    private static func stageTemporaryFile(named filename: String) throws -> ComposerAttachment {
        let sourceDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: sourceDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: sourceDirectory) }
        let source = sourceDirectory.appendingPathComponent(filename)
        try Data("hello".utf8).write(to: source)
        return try ComposerAttachmentStager.stageImportedFile(at: source)
    }
}
