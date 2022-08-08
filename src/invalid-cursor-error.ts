import {ObjectionPaginatorError} from "./objection-paginator-error.js";

/**
 * Error class which indicates that a problem was found with a cursor provided
 * to the `#execute` or `::getPage` methods of a Paginator.
 *
 * @remarks
 * Typically these errors indicate that a client passed a malformed cursor to
 * your api, such that it was either altered during transmission or was never
 * valid to begin with-- which can happen if clients try to re-use a cursor from
 * one query in another unrelated query, or attempt to create their own cursors.
 *
 * The contents of Objection Paginator cursors are an implementation detail
 * which clients should not rely on, even though they can easily parse them
 * since they are not encrypted.
 *
 * These errors should usually be caught by your api and replaced with some
 * indication of a mishandled cursor to the client.
 */
export class InvalidCursorError extends ObjectionPaginatorError {
	static getDefaultMessage(): string {
		return "Invalid cursor";
	}
}
