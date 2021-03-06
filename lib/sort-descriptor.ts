/**
 * Used to specify the direction of a SortDescriptor.
 */
export enum SortDirection {
	/**
	 * Indicates an ascending sort.
	 */
	Ascending = "asc",

	/**
	 * Indicates a descending sort.
	 */
	Descending = "desc",

	/**
	 * Indicates a descending sort, but with nulls last.
	 *
	 * @remarks
	 * This is the same as the descending sort unless the column is nullable.
	 */
	DescendingNullsLast = "descnl",
}

/**
 * Used to specify the SQL data type of sorted columns.
 */
export enum ColumnType {
	/**
	 * Indicates a string (varchar) column.
	 */
	String = "string",

	/**
	 * Indicates an integer column.
	 */
	Integer = "integer",

	/**
	 * Indicates a float column.
	 */
	Float = "float",

	/**
	 * Indicates a boolean column.
	 */
	Boolean = "boolean",

	/**
	 * Indicates a date or datetime column. This will accept either stings or JS date instances.
	 */
	Date = "date",
}

/**
 * The signature for custom validation functions.
 */
export interface ValidationFunction {
	/**
	 * A custom validation function.
	 * @param value - The value to validate.
	 * @returns true if valid, false if not. May also return a string to
	 *   indicate an invalid value, and the string will be used as the error
	 *   message.
	 */
	(value: any): boolean | string;
}

/**
 * An object used to describe a single column in a paginated sort.
 */
export interface SortDescriptor {
	/**
	 * The name of the column to sort by.
	 *
	 * @remarks
	 * This supports implicit table names, but as with Objection and Knex, you
	 * need to make sure that the column name does not conflict with other
	 * columns in the query for this to work. If you run into a situation where
	 * you must specify the table name, do so with `${tableName}.${columnName}`
	 * and make sure to adjust the `valuePath`.
	 *
	 * In the event that only the column name needs to be specified, you may
	 * simply provide it as a string in place of the entire descriptor.
	 */
	column: string;

	/**
	 * The SQL data type of the column, for the purpose of validating cursor
	 * values. Type names are as specified in Knex table builder methods.
	 * Defaults to 'string'.
	 *
	 * @remarks
	 * Currently this only supports 'string', 'integer', 'float', and 'boolean'.
	 * Precisions, scales, and lengths are not currently checked, so realize
	 * that clients may still cause database errors if they mess with your
	 * cursors.
	 *
	 * If you need find that you need better validation, or if you want support
	 * for other data types, such as `datetime` or some kind of enum, you may
	 * add it using the `validate` option.
	 */
	columnType?: ColumnType;

	/**
	 * Set to true to indicate that the column is nullable in your database.
	 * Defaults to false.
	 */
	nullable?: boolean;

	/**
	 * The direction to sort this column, 'asc' or 'desc'. Defaults to 'asc'.
	 */
	direction?: SortDirection;

	/**
	 * The dot-separated path used to obtain a cursor value for this column
	 * from an Objection Model instance. Defaults to the column name.
	 *
	 * @remarks
	 * Typically you will only need to use this option when sorting on columns
	 * joined in through a relationship. It defaults to the column name, so you
	 * don't usually need to specify it in other circumstances.
	 *
	 * @example
	 * Assuming you've specified a relationship between people and their
	 * favorite foods like so:
	 *
	 * ```ts
	 * import { Model } from 'objection';
	 * import { Food } from './food';
	 *
	 * class Person {
	 *     static tableName = 'people';
	 *     static relationships = {
	 *         favoriteFood: {
	 *             relation: Model.HasOneRelation,
	 *             modelClass: Food,
	 *             join: {
	 *                 from: 'people.favoriteFoodId',
	 *                 to: 'foods.id',
	 *             },
	 *         },
	 *     };
	 *
	 *     id: number;
	 *     name: string;
	 *     favoriteFoodId: number;
	 *     favoriteFood?: Food;
	 * }
	 * ```
	 *
	 * You can define a paginated query of people sorted first by ther favorite
	 * food's name, then by their own name, like so:
	 *
	 * ```ts
	 * import { Paginator } from 'objection-paginator';
	 * import { User } from '../models/user;
	 *
	 * export class UsersByFavoriteFood extends Paginator<User> {
	 *     static sorts = {
	 *         default: [
	 *             // Objection uses the relationship identifier as a table
	 *             // alias, so we can disambiguate which name we're talking
	 *             // about like so.
	 *             'favoriteFood.name',
	 *
	 *             // We also need to disambiguate the name column from the
	 *             // people table, but this causes the value path to not match
	 *             // the column name, so we have to specify it explicitly here.
	 *             { column: 'people.name', valuePath: 'name' },
	 *         ],
	 *     };
	 *
	 *     static getBaseQuery() {
	 *         // Note that we have to join here to make the sort work.
	 *         return User.query().withGraphJoined('favoriteFood');
	 *     }
	 * }
	 * ```
	 *
	 * See the test/lib directory in this module's GitHub repo for more
	 * examples.
	 */
	valuePath?: string;

	/**
	 * Allows you to specify a custom validation function which will be used to
	 * check cursor values both on cursor creation and on cursor consumption.
	 *
	 * @remarks
	 * This function should follow the signature `(value) => boolean|string`.
	 * If true is returned, the value is considered valid (assuming it passed
	 * the columnType check). If false or a string is returned, it is considered
	 * invalid. In the case of a string, the string will be used as the
	 * validation error message. In the case of false, a default message will be
	 * used.
	 */
	validate?: ValidationFunction;
}
