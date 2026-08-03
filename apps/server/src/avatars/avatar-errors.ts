/** The requester may not set or clear this avatar. */
export class AvatarDeniedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AvatarDeniedError';
    }
}

/** Nothing on this Server owns the avatar the requester named. */
export class AvatarOwnerNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AvatarOwnerNotFoundError';
    }
}

export type AvatarRejection = 'media_type' | 'size';

/** The uploaded bytes are not a usable avatar of the declared kind. */
export class AvatarRejectedError extends Error {
    readonly code: AvatarRejection;

    constructor(code: AvatarRejection, message: string) {
        super(message);
        this.code = code;
        this.name = 'AvatarRejectedError';
    }
}
