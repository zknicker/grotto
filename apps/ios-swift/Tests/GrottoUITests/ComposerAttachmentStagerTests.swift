import Foundation
@testable import GrottoUI
import Testing

struct ComposerAttachmentStagerTests {
    @Test func enforcesExactServerSizeLimit() throws {
        try ComposerAttachmentStager.validateSize(ComposerAttachmentStager.maximumSize)
        #expect(throws: ComposerAttachmentPreparationError.self) {
            try ComposerAttachmentStager.validateSize(ComposerAttachmentStager.maximumSize + 1)
        }
    }

    @Test func sanitizesProviderFilenames() {
        #expect(ComposerAttachmentStager.sanitizedFilename("../../pitch/deck.pdf") == "..-..-pitch-deck.pdf")
        #expect(ComposerAttachmentStager.sanitizedFilename("  ") == "Attachment")
    }

    @Test func ownsAndCleansUpImportedFile() throws {
        let sourceDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: sourceDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: sourceDirectory) }
        let source = sourceDirectory.appendingPathComponent("notes.txt")
        try Data("hello".utf8).write(to: source)

        let attachment = try ComposerAttachmentStager.stageImportedFile(at: source)
        #expect(attachment.sizeBytes == 5)
        #expect(attachment.filename == "notes.txt")
        #expect(FileManager.default.fileExists(atPath: attachment.localURL.path))

        ComposerAttachmentStager.remove(attachment)
        #expect(!FileManager.default.fileExists(atPath: attachment.localURL.path))
    }
}
