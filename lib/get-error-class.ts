import { ConfigurationError } from './configuration-error';
import { InvalidCursorError } from './invalid-cursor-error';
import { ObjectionPaginatorError } from './objection-paginator-error';

/**
 * An internal enum, used to indicate what kind of validation error to throw
 * when an invalid cursor value is encountered.
 */
export enum ValidationCase {
	/**
	 * Indicates that any encountered problems are with the sort configuration,
	 * and should thus cause a ConfigurationError.
	 */
	Configuration,

	/**
	 * Indicates that any encountered problems are with a cursor sent by the
	 * client, and should this cause an InvalidCursorError.
	 */
	Cursor,
}

/**
 * An internal function for switching error classes based on different cursor
 * value validation use cases.
 *
 * @remarks
 * This function is necessary because, when we encounter an invalid cursor
 * value, we need to know whether we're validating during cursor creation or
 * cursor consumption. This will help users identify where the problem actually
 * lies.
 *
 * @param validationCase - Used to indicate when validation is occurring.
 * @returns The error class to throw.
 */
export function getErrorClass(
	validationCase: ValidationCase,
): typeof ObjectionPaginatorError {
	switch (validationCase) {
		case ValidationCase.Configuration:
			return ConfigurationError;
		case ValidationCase.Cursor:
			return InvalidCursorError;
		default:
			throw new TypeError(`Unknown validation case ${validationCase}`);
	}
}
