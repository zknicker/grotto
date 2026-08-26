export class AvatarGenerationBusyError extends Error {
    constructor() {
        super('Avatar generation capacity is currently full.');
        this.name = 'AvatarGenerationBusyError';
    }
}

export class AvatarGenerationProviderError extends Error {
    constructor() {
        super('The image provider could not generate an avatar.');
        this.name = 'AvatarGenerationProviderError';
    }
}

export class AvatarGenerationUnavailableError extends Error {
    constructor() {
        super('Avatar generation is not configured on this Server.');
        this.name = 'AvatarGenerationUnavailableError';
    }
}

export class AvatarImageOutputError extends Error {
    constructor() {
        super('The image provider returned an unusable avatar.');
        this.name = 'AvatarImageOutputError';
    }
}

export class AvatarProviderError extends Error {
    constructor() {
        super('The image provider request failed.');
        this.name = 'AvatarProviderError';
    }
}
