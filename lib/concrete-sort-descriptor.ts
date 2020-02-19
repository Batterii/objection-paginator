import {
	ColumnType,
	SortDescriptor,
	SortDirection,
	ValidationFunction,
} from './sort-descriptor';
import { ValidationCase, getErrorClass } from './get-error-class';
import { defaults, isBoolean, isFinite, isInteger, isString } from 'lodash';
import { get as getPath } from 'object-path';

/**
 * Represents a single sort descriptor in a user-specified sort.
 *
 * @remarks
 * This is an internal class that is created from user-specified sort
 * descriptors. It normalizes those descriptors and contains methods for
 * interacting with them.
 */
export class ConcreteSortDescriptor {
	/**
	 * The column name to sort by.
	 */
	column: string;

	/**
	 * The type of the column, for validation purposes.
	 */
	columnType: ColumnType;

	/**
	 * Indicates whether or not thee column is nullable.
	 */
	nullable: boolean;

	/**
	 * The sort direction.
	 */
	direction: SortDirection;

	/**
	 * The dot-separated path to the cursor value in the last-fetched entity.
	 */
	valuePath: string;

	/**
	 * The custom validation function, if any was specified.
	 */
	validate?: ValidationFunction;

	/**
	 * Creates a ConcreteSortDescriptor.
	 * @param descriptor - The user-specified sort descriptor.
	 */
	constructor(descriptor: SortDescriptor | string) {
		if (isString(descriptor)) descriptor = { column: descriptor };

		defaults(this, descriptor, {
			columnType: ColumnType.String,
			nullable: false,
			direction: SortDirection.Ascending,
			valuePath: descriptor.column,
		});

		if (!Object.values(ColumnType).includes(this.columnType)) {
			throw new TypeError(`Unknown column type '${this.columnType}'`);
		}

		if (!Object.values(SortDirection).includes(this.direction)) {
			throw new TypeError(`Unknown sort direction '${this.direction}'`);
		}
	}

	/**
	 * Normalized sort order for non-null ORDER BY terms.
	 */
	get order(): 'asc'|'desc' {
		const { direction } = this;
		if (direction === SortDirection.DescendingNullsLast) {
			return SortDirection.Descending;
		}
		return direction;
	}

	/**
	 * Normalized sort order for `is null` ORDER BY terms.
	 */
	get nullOrder(): 'asc'|'desc' {
		const { direction } = this;
		if (direction === SortDirection.DescendingNullsLast) {
			return SortDirection.Ascending;
		}
		return direction;
	}

	/**
	 * The inequality operator to use in a cursor filter for this column.
	 */
	get operator(): '>'|'<' {
		return this.direction === SortDirection.Ascending ? '>' : '<';
	}

	/**
	 * Checks if a given cursor value matches the column type.
	 *
	 * @remarks
	 * This method simply returns true or false based on the check. It will not
	 * throw if the check fails.
	 *
	 * @param value - The value to check.
	 * @returns `true` if the value matches, `false` otherwise.
	 */
	checkCursorValue(value: any): boolean {
		switch (this.columnType) {
			case ColumnType.String:
				return isString(value);
			case ColumnType.Integer:
				return isInteger(value);
			case ColumnType.Float:
				return isFinite(value);
			case ColumnType.Boolean:
				return isBoolean(value);
			default:
				return false;
		}
	}

	/**
	 * Validates a given cursor value against the descriptor.
	 *
	 * @remarks
	 * This method will throw if the cursor is not valid. Which error class is
	 * thrown will depend on the `validationCase` parameter which specifies
	 * whether this validation is happening during cursor creation or cursor
	 * consumption. The former indicates a problem with the sort configuation,
	 * while the other indicates a cursor that was tampered with or transmitted
	 * incorrectly.
	 *
	 * @param value - The value to validate.
	 * @param validationCase - Indicates which error to throw on failure.
	 * @returns The unmutated value.
	 */
	validateCursorValue(value: any, validationCase: ValidationCase): any {
		if (value === null) {
			if (!this.nullable) {
				throw new (getErrorClass(validationCase))(
					'Cursor value is null, but column is not nullable',
					{ info: { value: null } },
				);
			}
		} else if (!this.checkCursorValue(value)) {
			throw new (getErrorClass(validationCase))(
				'Cursor value does not match its column type',
				{ info: { value, columnType: this.columnType } },
			);
		}

		const validateResult = this.validate ? this.validate(value) : true;
		let isValid: boolean;
		let msg: string | undefined;
		if (isString(validateResult)) {
			isValid = false;
			msg = validateResult;
		} else {
			isValid = validateResult;
			msg = 'Invalid cursor value';
		}

		if (isValid) return value;
		throw new (getErrorClass(validationCase))(msg, { info: { value } });
	}

	/**
	 * Gets the cursor value for this descriptor from the provided entity.
	 *
	 * @remarks
	 * This method also validates the value while fetching it. It is used during
	 * cursor creation only, so validation errors thrown here will be
	 * ConfigurationErrors.
	 *
	 * @param entity - The entity from which to fetch the value.
	 * @returns The fetched cursor value, or null if none was found.
	 */
	getCursorValue(entity: object): any {
		let value = getPath(entity, this.valuePath);
		if (value === undefined) value = null;
		return this.validateCursorValue(value, ValidationCase.Configuration);
	}
}
