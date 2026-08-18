import Observation
import SwiftUI

public enum ComposerOverlay: String, Identifiable {
    case sources
    case photos
    case camera

    public var id: String { rawValue }
}

@MainActor
@Observable
public final class ComposerInteraction {
    public var attachments: [ComposerAttachment] = []
    public var overlay: ComposerOverlay?
    public var isFileImporterPresented = false
    public var isPreparingAttachment = false
    public var errorMessage: String?
    public var morphingAttachmentID: String?
    public private(set) var attachmentReadySequence = 0
    public private(set) var lastReadyAttachmentCount = 0
    var morphDestinationFrame: CGRect?

    private var preparationTask: Task<Void, Never>?

    public init() {}

    var remainingCapacity: Int { max(0, 20 - attachments.count) }

    func preparePhotoFiles(_ urls: [URL]) async -> [ComposerAttachment] {
        isPreparingAttachment = true
        defer { isPreparingAttachment = false }
        var prepared: [ComposerAttachment] = []
        for url in urls.prefix(remainingCapacity) {
            do {
                prepared.append(try ComposerAttachmentStager.stagePhoto(at: url))
            } catch {
                errorMessage = error.localizedDescription
            }
        }
        return prepared
    }

    func prepareCapturedPhoto(_ data: Data) -> ComposerAttachment? {
        do {
            return try ComposerAttachmentStager.stageCapturedPhoto(data)
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func stageImportedFiles(_ urls: [URL]) {
        preparationTask?.cancel()
        preparationTask = Task { @MainActor in
            isPreparingAttachment = true
            defer { isPreparingAttachment = false }
            for url in urls.prefix(remainingCapacity) {
                guard !Task.isCancelled else { return }
                do {
                    appendPrepared([try ComposerAttachmentStager.stageImportedFile(at: url)])
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    func remove(_ attachment: ComposerAttachment) {
        attachments.removeAll { $0.id == attachment.id }
        ComposerAttachmentStager.remove(attachment)
    }

    func appendPrepared(_ prepared: [ComposerAttachment]) {
        guard !prepared.isEmpty else { return }
        attachments.append(contentsOf: prepared)
        lastReadyAttachmentCount = prepared.count
        attachmentReadySequence += 1
    }

    func cleanUp() {
        preparationTask?.cancel()
        attachments.forEach(ComposerAttachmentStager.remove)
    }
}
