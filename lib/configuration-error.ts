import { ObjectionPaginatorError } from './objection-paginator-error';

export class ConfigurationError extends ObjectionPaginatorError {
	static getDefaultMessage(): string {
		return 'Configuration error';
	}
}
