import { randomBytes } from 'node:crypto';
import { type LoopbackProxy, startLoopbackProxy } from './proxy.ts';

interface AgentLaunchHost {
    proxy: LoopbackProxy;
    proxyToken: string;
}

const launchHosts = new Map<string, AgentLaunchHost>();

export function acquireAgentLaunchHost(input: {
    agentId: string;
    dataRoot: string;
    runnerToken: string;
    runId: string;
    serverId: string;
    serverOrigin: string;
    skillsDir: string;
}): AgentLaunchHost {
    const key = hostKey(input.serverId, input.agentId);
    const current = launchHosts.get(key);
    if (current) {
        current.proxy.setRunnerToken(input.runnerToken);
        current.proxy.setRunId(input.runId);
        current.proxy.resetSendCount();
        return current;
    }
    const proxyToken = `grta_${randomBytes(32).toString('base64url')}`;
    const created = {
        proxy: startLoopbackProxy({
            agentId: input.agentId,
            dataRoot: input.dataRoot,
            proxyToken,
            runnerToken: input.runnerToken,
            runId: input.runId,
            serverId: input.serverId,
            serverOrigin: input.serverOrigin,
            skillsDir: input.skillsDir,
        }),
        proxyToken,
    };
    launchHosts.set(key, created);
    return created;
}

/** Ends the Computer-local execution host for an Agent reset or retirement. */
export function disposeAgentLaunchHost(serverId: string, agentId: string): void {
    const key = hostKey(serverId, agentId);
    launchHosts.get(key)?.proxy.close();
    launchHosts.delete(key);
}

export function disposeServerLaunchHosts(serverId: string): void {
    for (const [key, host] of launchHosts) {
        if (key.startsWith(`${serverId}:`)) {
            host.proxy.close();
            launchHosts.delete(key);
        }
    }
}

function hostKey(serverId: string, agentId: string): string {
    return `${serverId}:${agentId}`;
}
