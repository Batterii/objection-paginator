import { ObjectionPaginatorError } from './objection-paginator-error';

/**
 * Error class which indicates that a problem was found with the sort
 * configuration of a Paginator.
 *
 * @remarks
 * Typically these indicate mistakes on the part of the developer who wrote the
 * Paginator-- specifying a column type that does not match the value found by
 * the Paginator when creating a cursor, for example.
 */
export class ConfigurationError extends ObjectionPaginatorError {
	static getDefaultMessage(): string {
		return 'Configuration error';
	}
}
