import * as React from 'react';

export interface UserProfile {
    avatarUrl: string | null;
    displayName: string | null;
}

const storageKey = 'grotto.user.profile.v1';
const emptyProfile: UserProfile = { avatarUrl: null, displayName: null };
const listeners = new Set<() => void>();

// useSyncExternalStore requires a stable snapshot reference while the stored
// value is unchanged, so cache the parsed object keyed by its raw string.
let cachedRaw: string | null = null;
let cachedProfile: UserProfile = emptyProfile;

export function useUserProfilePreference() {
    const profile = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    return {
        avatarUrl: profile.avatarUrl,
        displayName: profile.displayName,
        setAvatar: setUserAvatar,
        setDisplayName: setUserDisplayName,
    };
}

function subscribe(listener: () => void) {
    listeners.add(listener);

    if (typeof window === 'undefined') {
        return () => listeners.delete(listener);
    }

    const handleStorage = (event: StorageEvent) => {
        if (event.key === storageKey) {
            listener();
        }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', handleStorage);
    };
}

function getSnapshot(): UserProfile {
    if (typeof window === 'undefined') {
        return emptyProfile;
    }

    const raw = window.localStorage.getItem(storageKey);

    if (raw === cachedRaw) {
        return cachedProfile;
    }

    cachedRaw = raw;
    cachedProfile = parseProfile(raw);

    return cachedProfile;
}

function getServerSnapshot(): UserProfile {
    return emptyProfile;
}

function setUserAvatar(avatarUrl: string | null) {
    writeProfile({ ...getSnapshot(), avatarUrl });
}

function setUserDisplayName(displayName: string | null) {
    const trimmed = displayName?.trim() ?? '';

    writeProfile({ ...getSnapshot(), displayName: trimmed.length > 0 ? trimmed : null });
}

function writeProfile(profile: UserProfile) {
    if (typeof window === 'undefined') {
        return;
    }

    if (profile.avatarUrl || profile.displayName) {
        window.localStorage.setItem(storageKey, JSON.stringify(profile));
    } else {
        window.localStorage.removeItem(storageKey);
    }

    for (const listener of listeners) {
        listener();
    }
}

export function parseUserProfile(raw: string | null): UserProfile {
    return parseProfile(raw);
}

function parseProfile(raw: string | null): UserProfile {
    if (!raw) {
        return emptyProfile;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<UserProfile>;

        return {
            avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : null,
            displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
        };
    } catch {
        return emptyProfile;
    }
}
