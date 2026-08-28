import Foundation
import GrottoModels

/// The JSON returned by the Server after attachment bytes have been accepted.
public struct AttachmentUploadResult: Decodable, Equatable, Sendable {
    public let attachment: AttachmentMetadata
    public let idempotent: Bool

    public init(attachment: AttachmentMetadata, idempotent: Bool) {
        self.attachment = attachment
        self.idempotent = idempotent
    }
}

/// Errors produced by the raw attachment transfer routes.
public enum AttachmentTransferError: Error, Equatable, LocalizedError, Sendable {
    case invalidIdentifier
    case invalidUploadFile
    case invalidResponse(status: Int, body: String)
    case server(status: Int, message: String)
    case decoding(String)
    case transport(String)

    public var errorDescription: String? {
        switch self {
        case .invalidIdentifier:
            return "The attachment or Server identifier is invalid."
        case .invalidUploadFile:
            return "The attachment upload file could not be read."
        case let .invalidResponse(status, body):
            return "Invalid attachment response (HTTP \(status)): \(body)"
        case let .server(_, message):
            return message
        case let .decoding(message):
            return "Unable to decode attachment response: \(message)"
        case let .transport(message):
            return "Attachment transfer failed: \(message)"
        }
    }
}

public extension TRPCClient {
    /// Uploads a previously reserved attachment's bytes to the Server.
    ///
    /// Reservation and message association stay on the tRPC boundary. This
    /// method only owns the raw byte transfer, matching the web App's
    /// `PUT /attachments/:serverId/:attachmentId` route.
    func uploadAttachment(
        serverID: String,
        attachmentID: String,
        fileURL: URL
    ) async throws -> AttachmentUploadResult {
        let url = try attachmentURL(serverID: serverID, attachmentID: attachmentID)
        guard fileURL.isFileURL else {
            throw AttachmentTransferError.invalidUploadFile
        }

        let fileSize: Int64
        do {
            let values = try fileURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
            guard values.isRegularFile == true, let size = values.fileSize else {
                throw AttachmentTransferError.invalidUploadFile
            }
            fileSize = Int64(size)
        } catch let error as AttachmentTransferError {
            throw error
        } catch {
            throw AttachmentTransferError.invalidUploadFile
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(String(fileSize), forHTTPHeaderField: "Content-Length")
        let token = try await sessionTokenProvider.readSessionToken()
        for (header, value) in config.headers(sessionToken: token) {
            request.setValue(value, forHTTPHeaderField: header)
        }

        do {
            let (data, response) = try await session.upload(for: request, fromFile: fileURL)
            let httpResponse = try attachmentHTTPResponse(response)
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw attachmentServerError(data: data, status: httpResponse.statusCode)
            }
            do {
                return try decoder.decode(AttachmentUploadResult.self, from: data)
            } catch {
                throw AttachmentTransferError.decoding(String(reflecting: error))
            }
        } catch let error as AttachmentTransferError {
            throw error
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw AttachmentTransferError.transport(error.localizedDescription)
        }
    }

    /// Downloads attachment bytes into an isolated temporary directory.
    ///
    /// The returned file is named with the caller's display filename, but the
    /// filename is sanitized and cannot escape the randomized temp directory.
    /// The caller owns cleanup of the returned file when it is no longer needed.
    func downloadAttachment(
        serverID: String,
        attachmentID: String,
        displayFilename: String
    ) async throws -> URL {
        let url = try attachmentURL(serverID: serverID, attachmentID: attachmentID)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        let token = try await sessionTokenProvider.readSessionToken()
        for (header, value) in config.headers(sessionToken: token) {
            request.setValue(value, forHTTPHeaderField: header)
        }

        do {
            let (temporaryDownloadURL, response) = try await session.download(for: request)
            let httpResponse = try attachmentHTTPResponse(response)
            guard (200..<300).contains(httpResponse.statusCode) else {
                let data = (try? Data(contentsOf: temporaryDownloadURL)) ?? Data()
                throw attachmentServerError(data: data, status: httpResponse.statusCode)
            }

            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent("GrottoAttachments", isDirectory: true)
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true
            )
            let destination = directory.appendingPathComponent(
                safeAttachmentFilename(displayFilename),
                isDirectory: false
            )
            do {
                try FileManager.default.moveItem(at: temporaryDownloadURL, to: destination)
            } catch {
                try? FileManager.default.removeItem(at: directory)
                throw AttachmentTransferError.transport(error.localizedDescription)
            }
            return destination
        } catch let error as AttachmentTransferError {
            throw error
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw AttachmentTransferError.transport(error.localizedDescription)
        }
    }
}

private extension TRPCClient {
    func attachmentURL(serverID: String, attachmentID: String) throws -> URL {
        guard isSafeAttachmentPathComponent(serverID), isSafeAttachmentPathComponent(attachmentID) else {
            throw AttachmentTransferError.invalidIdentifier
        }
        return config.serverOrigin
            .appendingPathComponent("attachments", isDirectory: false)
            .appendingPathComponent(serverID, isDirectory: false)
            .appendingPathComponent(attachmentID, isDirectory: false)
    }

    func attachmentHTTPResponse(_ response: URLResponse) throws -> HTTPURLResponse {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AttachmentTransferError.transport("The Server returned a non-HTTP response.")
        }
        return httpResponse
    }

    func attachmentServerError(data: Data, status: Int) -> AttachmentTransferError {
        if let body = try? decoder.decode(AttachmentErrorBody.self, from: data),
           !body.error.isEmpty
        {
            return .server(status: status, message: body.error)
        }
        return .invalidResponse(
            status: status,
            body: String(data: data, encoding: .utf8) ?? "<non-UTF8>"
        )
    }
}

private struct AttachmentErrorBody: Decodable {
    let error: String
}

func isSafeAttachmentPathComponent(_ value: String) -> Bool {
    !value.isEmpty &&
        value != "." &&
        value != ".." &&
        !value.contains("/") &&
        !value.contains("\\") &&
        !value.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains)
}

/// The one sanitizer for an attachment's on-disk name, shared by the transport's
/// temporary download directory and `AttachmentFileCache`.
func safeAttachmentFilename(_ filename: String) -> String {
    let pathComponent = URL(fileURLWithPath: filename).lastPathComponent
    let sanitized = pathComponent.unicodeScalars.map { scalar in
        CharacterSet.controlCharacters.contains(scalar) ? "_" : String(scalar)
    }.joined()
    guard !sanitized.isEmpty, sanitized != ".", sanitized != ".." else {
        return "attachment"
    }
    return sanitized
}
