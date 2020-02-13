import { ObjectionPaginatorError } from './objection-paginator-error';

/**
 * Error class indicating that a sort name was specified which does not exist
 * in a Paginator subtype's static sorts property.
 *
 * @remarks
 * If you are allowing clients to specify desired sort names, and you are not
 * validating the client-provided sort names in some other way, you may want to
 * catch these errors and indicate the problem to the client, possibly with a
 * list of sort names that *are* supported.
 */
export class UnknownSortError extends ObjectionPaginatorError {
	static getDefaultMessage(info?: Record<string, any>): string {
		let msg = 'Unknown sort';
		if (info && 'sort' in info) msg += `: '${info.sort}'`;
		return msg;
	}
}
