export type ComputerLoginErrorCode =
    | 'computer_login_already_approved'
    | 'computer_login_consumed'
    | 'computer_login_denied'
    | 'computer_login_expired'
    | 'computer_login_invalid_origin'
    | 'computer_login_malformed'
    | 'computer_login_not_found';

export class ComputerLoginError extends Error {
    constructor(
        readonly code: ComputerLoginErrorCode,
        message: string,
        readonly httpStatus: number
    ) {
        super(message);
        this.name = 'ComputerLoginError';
    }
}

export function computerLoginError(code: ComputerLoginErrorCode): ComputerLoginError {
    const messages: Record<ComputerLoginErrorCode, string> = {
        computer_login_already_approved: 'This Computer login was already approved.',
        computer_login_consumed: 'This Computer login was already completed.',
        computer_login_denied: 'This Computer login was denied.',
        computer_login_expired: 'This Computer login expired. Run login again.',
        computer_login_invalid_origin: 'Computer login origin must be a valid HTTP(S) origin.',
        computer_login_malformed: 'That Computer login code is not valid.',
        computer_login_not_found: 'No Computer login is waiting for that code.',
    };
    const statuses: Record<ComputerLoginErrorCode, number> = {
        computer_login_already_approved: 409,
        computer_login_consumed: 409,
        computer_login_denied: 403,
        computer_login_expired: 410,
        computer_login_invalid_origin: 400,
        computer_login_malformed: 400,
        computer_login_not_found: 404,
    };
    return new ComputerLoginError(code, messages[code], statuses[code]);
}
