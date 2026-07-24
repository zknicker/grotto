import type { AgentArchetypeId } from '@tavern/api';

/**
 * Archetype-driven agent-creation proposals (WS8), adapted from the Raft
 * recipe archetype cards. Selecting one proposes a handle and a one-line
 * description (the personality surface — it rides every envelope) and tells
 * the runtime to seed the matching lane note into the new agent's workspace.
 * Everything is editable after creation; the archetype itself is not stored.
 */
export interface AgentArchetypeProposal {
    /** One-line agent description; becomes the bio / Initial role. */
    bio: string;
    /** Suggested handle; unique-suffixed against existing agents. */
    handle: string;
    id: AgentArchetypeId;
    label: string;
    /** Short menu subtitle. */
    tagline: string;
}

export const agentArchetypeProposals: AgentArchetypeProposal[] = [
    {
        bio: 'Operator — ships scoped, verified changes end to end',
        handle: 'operator',
        id: 'operator',
        label: 'Operator',
        tagline: 'Ships changes end to end, with previews',
    },
    {
        bio: 'Data analyst — decision-shaped reads with the source attached',
        handle: 'analyst',
        id: 'analyst',
        label: 'Analyst',
        tagline: 'Turns data into decision-shaped reads',
    },
    {
        bio: 'Designer — visuals as editable artifacts, structure before polish',
        handle: 'designer',
        id: 'designer',
        label: 'Designer',
        tagline: 'Visuals and mockups the team iterates on',
    },
    {
        bio: "Writer — drafts in the owner's voice; the owner ships",
        handle: 'writer',
        id: 'writer',
        label: 'Writer',
        tagline: 'Drafts in your voice; you ship',
    },
    {
        bio: 'Coordinator — briefs, routing, and the pending-on-you list',
        handle: 'coordinator',
        id: 'coordinator',
        label: 'Coordinator',
        tagline: 'One owner-facing surface over every channel',
    },
    {
        bio: 'Patrol — standing watch on one domain; finds and routes, never fixes',
        handle: 'patrol',
        id: 'patrol',
        label: 'Patrol',
        tagline: 'Continuous watch over one domain',
    },
    {
        bio: 'Verify gate — checks claims against the real surface; reports, never rewrites',
        handle: 'gate',
        id: 'gate',
        label: 'Verify gate',
        tagline: 'Checks outputs against reality before they ship',
    },
    {
        // Cove is also the shipped default agent on production first runs
        // (server agents/shipped-default.ts) — same name, bio, and seeds.
        bio: 'Onboarding guide — helps you shape your team and start real work',
        handle: 'Cove',
        id: 'guide',
        label: 'Cove — onboarding guide',
        tagline: 'Helps you set up Grotto and your first agents',
    },
];
