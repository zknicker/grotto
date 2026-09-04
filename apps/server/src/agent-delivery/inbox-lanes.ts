/**
 * Which inbox items ride the concrete lane. A concrete item's envelope is
 * composed into the run's own first prompt and is served the moment the
 * Computer accepts that run; everything else rides the notice lane, where the
 * Agent decides whether to pull the body. Fires and task assignments are
 * concrete because they exist nowhere but the inbox: a discretionary pull is
 * the only thing standing between the wake and its reason, and an unread one
 * leaves an answer with no provable cause (specs/inbox.md).
 */
export const concreteInboxSources = [
    'onboarding',
    'action',
    'trigger',
    'reminder',
    'task_assignment',
] as const;

export function isConcreteInboxSource(source: string): boolean {
    return (concreteInboxSources as readonly string[]).includes(source);
}
