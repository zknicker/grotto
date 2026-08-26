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

    /// The interaction outlives the screen that draws it, so leaving that screen
    /// resets what the screen owned and keeps what the Chat owns: the staged
    /// files stay, an open portal and a frozen keyboard inset do not come back.
    @Test func resetPresentationKeepsStagedFilesAndDropsScreenState() throws {
        let interaction = ComposerInteraction()
        let staged = try Self.stageTemporaryFile(named: "notes.txt")
        interaction.appendPrepared([staged])
        interaction.overlay = .photos
        interaction.isFileImporterPresented = true
        interaction.morphingAttachmentID = staged.id
        interaction.morphDestinationFrame = CGRect(x: 0, y: 0, width: 88, height: 88)
        interaction.composerSurfaceFrame = CGRect(x: 0, y: 600, width: 390, height: 96)
        interaction.errorMessage = "Message not sent. Your draft is ready to retry."
        interaction.portalFreeze.engage(bottomInset: 336, isTextFocused: true)

        interaction.resetPresentation()

        #expect(interaction.attachments.map(\.id) == [staged.id])
        #expect(FileManager.default.fileExists(atPath: staged.localURL.path))
        #expect(interaction.overlay == nil)
        #expect(!interaction.isFileImporterPresented)
        #expect(interaction.morphingAttachmentID == nil)
        #expect(interaction.morphDestinationFrame == nil)
        #expect(interaction.composerSurfaceFrame == nil)
        #expect(interaction.errorMessage == nil)
        #expect(!interaction.portalFreeze.isEngaged)
        #expect(!interaction.isPortalActive)
        // A frozen inset from a screen that is gone must not lay the next one out.
        #expect(interaction.portalFreeze.bottomInset(live: 34) == 34)

        interaction.cleanUp()
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
