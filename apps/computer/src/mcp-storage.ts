import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AttachmentMcpSecret } from './mcp-oauth.ts';
import type { AttachmentMcpConnection, StoredAttachmentMcpConnection } from './mcp-runtime.ts';

export class AttachmentMcpStorage {
    constructor(private readonly root: string) {}

    async save(connection: AttachmentMcpConnection): Promise<void> {
        await Promise.all([
            mkdir(this.connectionsRoot(), { mode: 0o700, recursive: true }),
            mkdir(this.vaultRoot(), { mode: 0o700, recursive: true }),
        ]);
        await this.writeJson(this.connectionPath(connection.id), {
            args: connection.args,
            auth: connection.auth,
            command: connection.command,
            id: connection.id,
            name: connection.name,
            oauthClientId: connection.oauthClientId,
            oauthScopes: connection.oauthScopes,
            preset: connection.preset,
            url: connection.url,
        } satisfies StoredAttachmentMcpConnection);
        await this.writeSecret(connection.id, {
            approvedAuthorizationServerOrigins: [],
            configuredClientInformation: connection.oauthClientId
                ? {
                      client_id: connection.oauthClientId,
                      ...(connection.oauthClientSecret
                          ? { client_secret: connection.oauthClientSecret }
                          : {}),
                  }
                : undefined,
            env: connection.env,
            headers: connection.headers,
            oauthScopes: connection.oauthScopes,
        });
    }

    async readConnection(connectionId: string): Promise<StoredAttachmentMcpConnection> {
        try {
            return JSON.parse(
                await readFile(this.connectionPath(connectionId), 'utf8')
            ) as StoredAttachmentMcpConnection;
        } catch {
            throw new Error('MCP connection does not belong to this attachment.');
        }
    }

    async readSecret(connectionId: string): Promise<AttachmentMcpSecret> {
        try {
            return JSON.parse(
                await readFile(this.vaultPath(connectionId), 'utf8')
            ) as AttachmentMcpSecret;
        } catch {
            return {
                approvedAuthorizationServerOrigins: [],
                env: {},
                headers: {},
                oauthScopes: [],
            };
        }
    }

    async writeSecret(connectionId: string, secret: AttachmentMcpSecret): Promise<void> {
        await mkdir(this.vaultRoot(), { mode: 0o700, recursive: true });
        await this.writeJson(this.vaultPath(connectionId), secret);
    }

    async deleteConnection(connectionId: string): Promise<void> {
        await rm(this.connectionPath(connectionId), { force: true });
    }

    async deleteSecret(connectionId: string): Promise<void> {
        await rm(this.vaultPath(connectionId), { force: true });
    }

    private connectionPath(connectionId: string): string {
        return join(this.connectionsRoot(), `${this.checkedId(connectionId)}.json`);
    }

    private vaultPath(connectionId: string): string {
        return join(this.vaultRoot(), `${this.checkedId(connectionId)}.json`);
    }

    private checkedId(connectionId: string): string {
        if (!/^mcp_[A-Za-z0-9_-]{16}$/u.test(connectionId)) {
            throw new Error('Invalid MCP connection id.');
        }
        return connectionId;
    }

    private connectionsRoot(): string {
        return join(this.root, 'connections');
    }

    private vaultRoot(): string {
        return join(this.root, 'vault');
    }

    private async writeJson(path: string, value: unknown): Promise<void> {
        const temporary = `${path}.tmp`;
        await writeFile(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
        await rename(temporary, path);
    }
}
