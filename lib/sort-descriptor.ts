export enum SortDirection {
	Ascending = 'asc',
	Descending = 'desc',
}

export enum ColumnType {
	String = 'string',
	Int = 'int',
	Float = 'float',
	Boolean = 'boolean',
}

export interface ValidationFunction {
	(value: any): boolean | string;
}

export interface SortDescriptor {
	column: string;
	columnType?: ColumnType;
	direction?: SortDirection;
	valuePath?: string;
	validate?: ValidationFunction;
}
