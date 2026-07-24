import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentRuntimeAgent, AgentRuntimeModelName } from '@tavern/api';
import runtimePackage from '../../package.json' with { type: 'json' };
import { hasAgentHostToolGrant } from '../agent-engine/host-tools.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { resolveAgentModelSelection } from '../models/selection-service.ts';
import { getStoredAgent } from '../tavern/agents-store.ts';
import { publishRuntimeEvent } from '../tavern/runtime-events.ts';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import { modelProviderHasWebSearch } from '../web/agent-tools.ts';
import { agentWorkDirectoryName, renderAgentInstructions } from './managed-instructions.ts';

export interface AgentWorkspaceSource {
    agentId: string;
    agentName: string;
    updatedAt: string;
    workspaceDir: string;
}

export interface AgentInstructionGenerateResult {
    content: string;
    renderedAt: string;
    sha256: string;
    written: boolean;
}

export interface AgentInstructionReadResult {
    agentId: string;
    content: string;
    renderedAt: string | null;
    sha256: string | null;
    updatedAt: string | null;
}

/** Host facts for the Current Runtime Context section; injectable in tests. */
export interface AgentRuntimeContextFacts {
    hostname: string;
    os: string;
    runtimeVersion: string;
}

export interface GenerateAgentInstructionOptions {
    /** Engine callers pass the resolved agent record; admin callers omit it. */
    agent?: AgentRuntimeAgent | null;
    model?: AgentRuntimeModelName;
    runtimeContext?: AgentRuntimeContextFacts;
}

const defaultAgentId = 'main';
const defaultAgentName = 'main';
const legacyGeneratedCompanionFiles = [
    'BOOTSTRAP.md',
    'HEARTBEAT.md',
    'IDENTITY.md',
    'ROLE.md',
    'TOOLS.md',
] as const;

export function getAgentWorkspaceSource(
    db: Database,
    agentId: string
): AgentWorkspaceSource | null {
    const row = db
        .prepare(
            `SELECT agent_id, agent_name, workspace_dir, updated_at
             FROM workspace_agent_instructions
             WHERE agent_id = ?`
        )
        .get(agentId) as
        | {
              agent_id: string;
              agent_name: string;
              updated_at: string;
              workspace_dir: string;
          }
        | undefined;

    return row
        ? {
              agentId: row.agent_id,
              agentName: row.agent_name,
              updatedAt: row.updated_at,
              workspaceDir: row.workspace_dir,
          }
        : null;
}

export function registerAgentWorkspace(
    db: Database,
    input: {
        agentId?: string | null;
        agentName?: string | null;
        workspaceDir: string;
    }
) {
    const timestamp = new Date().toISOString();
    const agentId = input.agentId?.trim() || defaultAgentId;
    const existing = getAgentWorkspaceSource(db, agentId);
    const agentName = input.agentName?.trim() || existing?.agentName || defaultAgentName;

    db.prepare(
        `INSERT INTO workspace_agent_instructions (
            agent_id, agent_name, workspace_dir, created_at, updated_at
        ) VALUES (
            $agentId, $agentName, $workspaceDir, $timestamp, $timestamp
        )
        ON CONFLICT(agent_id) DO UPDATE SET
            agent_name = excluded.agent_name,
            workspace_dir = excluded.workspace_dir,
            updated_at = excluded.updated_at`
    ).run(
        namedParams({
            agentId,
            agentName,
            timestamp,
            workspaceDir: input.workspaceDir,
        })
    );

    return getAgentWorkspaceSource(db, agentId) as AgentWorkspaceSource;
}

/**
 * Generate the agent system prompt body from the managed Raft template
 * (ws2-prompt-draft.md). The render is near-deterministic per agent: host
 * facts, the agent record, and the effective model's web-search capability
 * are the only inputs. Model-family operational sections compose downstream
 * (tavern/agent-instructions.ts).
 */
export async function generateAgentInstructions(
    db: Database,
    agentId = defaultAgentId,
    options: GenerateAgentInstructionOptions = {}
) {
    const source = getAgentWorkspaceSource(db, agentId);

    if (!source) {
        throw new Error(`No managed workspace is registered for agent "${agentId}".`);
    }

    await ensureAgentWorkDirectory(source.workspaceDir);
    await removeGeneratedInstructionFiles(source.workspaceDir);
    const agent = options.agent ?? getStoredAgent(source.agentId, db);
    const facts = options.runtimeContext ?? hostRuntimeContextFacts();
    const next = renderAgentInstructions({
        agentId: source.agentId,
        agentName: agent?.name ?? source.agentName,
        homeTimezone: resolveHomeTimezone(),
        hostname: facts.hostname,
        initialRole: agent?.bio ?? null,
        os: facts.os,
        runtimeVersion: facts.runtimeVersion,
        webAccess: resolveWebAccessVariant(agent, options.model, source.agentId),
        workspacePath: source.workspaceDir,
    });
    const previousHash = readRenderedInstructionHash(db, source.agentId);
    const renderedAt = new Date().toISOString();
    const sha256 = await hashText(next);
    const written = sha256 !== previousHash;

    db.prepare(
        `UPDATE workspace_agent_instructions
         SET rendered_at = $renderedAt, rendered_hash = $sha256, updated_at = $renderedAt
         WHERE agent_id = $agentId`
    ).run(namedParams({ agentId: source.agentId, renderedAt, sha256 }));

    if (written) {
        publishRuntimeEvent({
            agentId: source.agentId,
            renderedAt,
            sha256,
            timestamp: renderedAt,
            type: 'workspace.instructions.updated',
        });
    }

    return { content: next, renderedAt, sha256, written } satisfies AgentInstructionGenerateResult;
}

/**
 * Generate for callers that cannot assume the agent has a registered managed
 * workspace. Returns null when unregistered.
 */
export async function generateRegisteredAgentInstructions(db: Database, agentId: string) {
    return getAgentWorkspaceSource(db, agentId)
        ? await generateAgentInstructions(db, agentId)
        : null;
}

export async function readRenderedAgentInstructions(db: Database, agentId = defaultAgentId) {
    const generated = await generateAgentInstructions(db, agentId);
    const source = getAgentWorkspaceSource(db, agentId);
    return {
        agentId,
        content: generated.content,
        renderedAt: generated.renderedAt,
        sha256: generated.sha256,
        updatedAt: source?.updatedAt ?? null,
    } satisfies AgentInstructionReadResult;
}

function resolveWebAccessVariant(
    agent: AgentRuntimeAgent | null,
    model: AgentRuntimeModelName | undefined,
    agentId: string
): 'fetch-only' | 'search' | 'search-only' | null {
    if (agent?.webAccessEnabled !== true) {
        return null;
    }
    const effectiveModel = model ?? resolveAgentModelSelection({ agentId });
    const canFetch = hasAgentHostToolGrant(agentId, 'web_fetch');
    if (modelProviderHasWebSearch(effectiveModel.provider)) {
        return canFetch ? 'search' : 'search-only';
    }
    return canFetch ? 'fetch-only' : null;
}

function hostRuntimeContextFacts(): AgentRuntimeContextFacts {
    return {
        hostname: os.hostname(),
        os: `${os.type()} ${os.release()}`,
        runtimeVersion: runtimePackage.version,
    };
}

async function ensureAgentWorkDirectory(workspaceDir: string) {
    await fs.mkdir(path.join(workspaceDir, agentWorkDirectoryName), { recursive: true });
}

async function removeGeneratedInstructionFiles(workspaceDir: string) {
    await fs.rm(path.join(workspaceDir, 'AGENTS.md'), { force: true });
    await Promise.all(
        legacyGeneratedCompanionFiles.map(async (fileName) => {
            const filePath = path.join(workspaceDir, fileName);
            const stat = await fs.stat(filePath).catch(() => null);
            if (stat?.isFile() && stat.size === 0) {
                await fs.rm(filePath, { force: true });
            }
        })
    );
}

async function hashText(value: string) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readRenderedInstructionHash(db: Database, agentId: string) {
    const row = db
        .prepare(
            `SELECT rendered_hash
             FROM workspace_agent_instructions
             WHERE agent_id = ?`
        )
        .get(agentId) as { rendered_hash: string | null } | undefined;
    return row?.rendered_hash ?? null;
}
