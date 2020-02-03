import { ColumnType, SortDescriptor, SortDirection } from './sort-descriptor';
import { defaults, isBoolean, isFinite, isInteger, isString } from 'lodash';
import { ConfigurationError } from './configuration-error';
import { InvalidCursorError } from './invalid-cursor-error';

export class ConcreteSortDescriptor {
	column: string;
	columnType: ColumnType;
	direction: SortDirection;
	valuePath: string;

	constructor(descriptor: SortDescriptor) {
		defaults(this, descriptor, { valuePath: descriptor.column });
	}

	getOperator(): string {
		const { direction } = this;
		switch (direction) {
			case SortDirection.Ascending:
				return '>';
			case SortDirection.Descending:
				return '<';
			default:
				throw new ConfigurationError(
					`Unknown sort direction '${direction}'`,
				);
		}
	}

	checkCursorValue(value: any): boolean {
		const { columnType } = this;
		switch (columnType) {
			case ColumnType.String:
				return isString(value);
			case ColumnType.Number:
				return isFinite(value);
			case ColumnType.Int:
				return isInteger(value);
			case ColumnType.Boolean:
				return isBoolean(value);
			default:
				throw new ConfigurationError(
					`Unknown column type '${columnType}'`,
				);
		}
	}

	getNextCursorValue(values: any[]): any {
		const [ value ] = values;
		if (this.checkCursorValue(value)) return value;
		throw new InvalidCursorError(
			'Cursor value does not match its column type',
			{ info: { value, columnType: this.columnType } },
		);
	}
}
