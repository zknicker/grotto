import Foundation

/// Attachments as the UI sees them: a durable Server record on a message, and
/// a file the composer has staged but not yet sent.

public struct MessageAttachmentPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let filename: String
    public let mediaType: String
    public let sizeBytes: Int
    public let localURL: URL?

    public init(
        id: String,
        filename: String,
        mediaType: String,
        sizeBytes: Int,
        localURL: URL? = nil
    ) {
        self.id = id
        self.filename = filename
        self.mediaType = mediaType
        self.sizeBytes = sizeBytes
        self.localURL = localURL
    }

    public var isImage: Bool { mediaType.hasPrefix("image/") }
}

/// A local file staged by the native composer. The Server remains the owner of
/// durable attachment metadata and bytes after a successful send.
public struct ComposerAttachment: Identifiable, Hashable, Sendable {
    public let id: String
    public let filename: String
    public let mediaType: String
    public let sizeBytes: Int
    public let localURL: URL

    public init(
        id: String = UUID().uuidString.lowercased(),
        filename: String,
        mediaType: String,
        sizeBytes: Int,
        localURL: URL
    ) {
        self.id = id
        self.filename = filename
        self.mediaType = mediaType
        self.sizeBytes = sizeBytes
        self.localURL = localURL
    }

    public var presentation: MessageAttachmentPresentation {
        MessageAttachmentPresentation(
            id: id,
            filename: filename,
            mediaType: mediaType,
            sizeBytes: sizeBytes,
            localURL: localURL
        )
    }
}
