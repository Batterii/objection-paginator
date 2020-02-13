import { ConfigurationError } from './configuration-error';
import { InvalidCursorError } from './invalid-cursor-error';
import { ObjectionPaginatorError } from './objection-paginator-error';

export enum ValidationCase {
	Configuration,
	Cursor,
}

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
