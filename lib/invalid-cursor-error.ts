import { ObjectionPaginatorError } from './objection-paginator-error';

export class InvalidCursorError extends ObjectionPaginatorError {
	static getDefaultMessage(): string {
		return 'Invalid cursor';
	}
}
