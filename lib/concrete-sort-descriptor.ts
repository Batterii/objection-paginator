import {
	ColumnType,
	SortDescriptor,
	SortDirection,
	ValidationFunction,
} from './sort-descriptor';
import { defaults, isBoolean, isFinite, isInteger, isString } from 'lodash';
import { ConfigurationError } from './configuration-error';
import { InvalidCursorError } from './invalid-cursor-error';

export class ConcreteSortDescriptor {
	column: string;
	columnType: ColumnType;
	direction: SortDirection;
	valuePath: string;
	validate?: ValidationFunction;

	constructor(descriptor: SortDescriptor | string) {
		if (isString(descriptor)) descriptor = { column: descriptor };
		defaults(this, descriptor, {
			columnType: ColumnType.String,
			direction: SortDirection.Ascending,
			valuePath: descriptor.column,
		});
	}

	getOperator(): string {
		switch (this.direction) {
			case SortDirection.Ascending:
				return '>';
			case SortDirection.Descending:
				return '<';
			default:
				throw new ConfigurationError(
					`Unknown sort direction '${this.direction}'`,
				);
		}
	}

	checkCursorValue(value: any): boolean {
		switch (this.columnType) {
			case ColumnType.String:
				return isString(value);
			case ColumnType.Int:
				return isInteger(value);
			case ColumnType.Float:
				return isFinite(value);
			case ColumnType.Boolean:
				return isBoolean(value);
			default:
				throw new ConfigurationError(
					`Unknown column type '${this.columnType}'`,
				);
		}
	}

	validateCursorValue(value: any): any {
		if (!this.checkCursorValue(value)) {
			throw new InvalidCursorError(
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
		throw new InvalidCursorError(msg, { info: { value } });
	}

	getNextCursorValue(values: any[]): any {
		return this.validateCursorValue(values[0]);
	}
}
