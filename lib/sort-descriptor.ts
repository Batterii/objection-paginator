export enum SortDirection {
	Ascending = 'asc',
	Descending = 'desc',
}

export enum ColumnType {
	String = 'string',
	Number = 'number',
	Int = 'int',
	Boolean = 'boolean',
}

export interface SortDescriptor {
	column: string;
	columnType: ColumnType;
	direction: SortDirection;
	valuePath?: string;
}
