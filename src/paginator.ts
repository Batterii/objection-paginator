import {Model, QueryBuilder} from "objection";
import {isNil, last, mapValues} from "lodash";
import {Cursor} from "./cursor";
import {InvalidCursorError} from "./invalid-cursor-error";
import {SortDescriptor} from "./sort-descriptor";
import {SortNode} from "./sort-node";
import {UnknownSortError} from "./unknown-sort-error";
import {createSortNode} from "./create-sort-node";

/**
 * Paginator instance configuration.
 */
export interface PaginatorOptions {
	/**
	 * The maxiumum number of items to fetch in a page. Defaults to 1000.
	 */
	limit?: number;

	/**
	 * The name of the sort to use, as defined in the static sorts property.
	 * Defaults to 'default'.
	 */
	sort?: string;
}

/**
 * Options provided to the static ::getPage method.
 */
export interface GetPageOptions extends PaginatorOptions {
	/**
	 * The cursor to resume from, if any.
	 */
	cursor?: string|null;
}

/**
 * Represents the result of a single paginated query.
 */
export interface Page<T extends Model> {
	/**
	 * The model instances returned by the query.
	 */
	items: T[];

	/**
	 * The number of items remaining after this page.
	 */
	remaining: number;

	/**
	 * The cursor string for getting the next page.
	 */
	cursor: string;
}

/**
 * A tuple that includes an item of type T if and only if T is not undefined.
 *
 * @remarks
 * This is used in the constructor and getPage type signatures in order to make
 * the TArgs type argument fully optional. You may need it if you intend to
 * override either of these.
 */
export type If<T> = T extends undefined ? [] : [T];

/**
 * A generic interface that must be implemented by all Paginator constructors.
 *
 * @remarks
 * This is used as a workaround to bind generic types to the static getPage
 * method, which is otherwise not possible in TypeScript. You may need it if you
 * intend to override this method.
 */
export interface PaginatorConstructor<TModel extends Model, TArgs = undefined> {
	new (
		options?: PaginatorOptions,
		...rest: If<TArgs>
	): Paginator<TModel, TArgs>;
}

/**
 * A base class for defining paginated queries in Objection.
 *
 * @remarks
 * This class accepts the following type parameters:
 * - TModel: The type of Model instances returned by queries. Must be a subtype
 *     of the Objection Model class.
 * - TArgs: Required aruments for queries. If omittied, no arguments are
 *     required.
 *
 * To define a paginated query, extend this class, providing the TModel as well
 * as the TArgs if desired. You must provide an implementation for the
 * `#getBaseQuery` method, and you probably should at least define a default
 * sort on the static `sorts` property. Any alternate sorting methods should be
 * defined there as well.
 *
 * When defining sorts, you should take care to ensure that the combination of
 * sort values will always produce a deterministic sort order. In other words,
 * the combination of specified columns should always be unique within your
 * database. If you fail to do this, the sort order may vary based on the
 * implementation details of your database, possibly causing inconsistent
 * pagination.
 *
 * @example
 * The following subtype defines a paginated query on people, sorted by their
 * firstName, lastName, then id. The id is included since it is known to be
 * unique, while the combination of firstName and lastName is not:
 *
 * ```ts
 * import { Paginator } from 'objection-paginator';
 * import { Person } from '../models/person';
 * import { QueryBuilder } from 'objection';
 *
 * export class People extends Paginator<Person> {
 *     static sorts = { default: [ 'firstName', 'lastName', 'id' ] };
 *
 *     // Note: *do not* mark this method as `async`. You want to return the
 *     // builder itself, without executing it. This allows the paginator to
 *     // mutate it as needed before executing.
 *     getBaseQuery(): QueryBuilder<Person> {
 *         return Person.query();
 *     }
 * }
 *
 * ```
 *
 * Additional arguments for your query, which can be specified using the TArgs
 * property, will be available through `this.args` in the `#getBaseQuery`
 * method:
 *
 * ```ts
 * export interface PeopleWithFirstNameArgs {
 *    firstName: string;
 * }
 *
 * export class PeopleWithFirstName extends Paginator<
 *     Person,
 *     PeopleWithFirstNameArgs,
 * > {
 *     static sorts = { default: [ 'lastName', 'id' ] };
 *
 *     getBaseQuery(): QueryBuilder<Person> {
 *         return Person.query().where({ firstName: this.args.firstName });
 *     }
 * }
 *
 * ```
 *
 * For more examples, see the README and the `test/lib` directory of this
 * module's GitHub repo.
 */
export abstract class Paginator<TModel extends Model, TArgs = undefined> {
	/**
	 * A map from supported sort names to sort descriptor arrays.
	 *
	 * @remarks
	 * Each item in a descriptor array should be a single column name, or a full
	 * sort descriptor object. Fetched items will be sorted by the first
	 * descriptor, then the next, and so on.
	 *
	 * For each concrete Paginator subtype, you should at least specify a
	 * default sort. Additional sorts can be added by simply adding more
	 * properties to this map.
	 */
	static sorts?: Record<string, (SortDescriptor|string)[]>;

	/**
	 * Used to uniquely identify a Paginator subtype.
	 *
	 * @remarks
	 * This will be stored in cursors created by this Paginator subtype, and
	 * will be checked when consuming cursors to ensure cursors from completely
	 * unrelated queries aren't being sent in by clients.
	 *
	 * This defaults to the constructor name of your subtype, so there is
	 * usually no need to set it unless there's a naming collision or you'd
	 * simply like to specify your own.
	 */
	static queryName?: string;

	/**
	 * Cached sort nodes, created within each subtype the first time it is used.
	 */
	private static _sortNodes?: Record<string, SortNode|undefined>;

	/**
	 * The maximum number of items to fetch for a page.
	 *
	 * @remarks
	 * For optimization purposes, this property is read-only. If you need to
	 * change the limit, simply create another instance.
	 */
	readonly limit: number;

	/**
	 * The name of the sort to use, as defined in the static sorts property.
	 *
	 * @remarks
	 * For optimization purposes, this property is read-only. If you need to
	 * change the sort, simply create another instance.
	 */
	readonly sort: string;

	/**
	 * The args provided to the instance, if any.
	 */
	args: TArgs;

	/**
	 * Creates a Paginator.
	 *
	 * @remarks
	 * Since this class is abstract, you will need to create a subtype before
	 * you can use this constructor. It will throw if called directly.
	 *
	 * @param options - Instance-level configuration options.
	 * @param rest - Remaining parameters. Will include the paginator args,
	 *   if any.
	 */
	constructor(options: PaginatorOptions = {}, ...rest: If<TArgs>) {
		const {limit, sort} = options;
		Object.defineProperties(this, {
			limit: {value: limit || 1000, enumerable: true},
			sort: {value: sort || "default", enumerable: true},
			args: {value: rest[0], enumerable: true, writable: true},
		});
	}

	/**
	 * Creates and executes a Paginator in one call.
	 *
	 * @remarks
	 * Like the constructor itself, this method cannot be used except through
	 * a non-abstract subtype. It will throw if you try.
	 *
	 * @param options - Instance-level configuration options, along with an
	 *   optional cursor string.
	 * @param rest - Remaining parameters. Will include the paginator args, if
	 * 	 any.
	 */
	static async getPage<TModel extends Model, TArgs = undefined>(
		this: PaginatorConstructor<TModel, TArgs>,
		options?: GetPageOptions,
		...rest: If<TArgs>
	): Promise<Page<TModel>> {
		return new this(options, ...rest).execute(options && options.cursor);
	}

	/**
	 * Gets an identifier to include and check in cursors.
	 * @returns The queryName property, if specified, or the constructor name
	 *   if not.
	 */
	private static _getQueryName(): string {
		return this.queryName || this.name;
	}

	/**
	 * Creates all of the sort nodes from the static sorts property.
	 *
	 * @remarks
	 * This method will only be called once for a particular subtype. Its
	 * result will be cached on the class itself.
	 *
	 * @returns The created map from sort names to sort nodes.
	 */
	private static _createSortNodes(): Record<string, SortNode> {
		return this.sorts ? mapValues(this.sorts, createSortNode) : {};
	}

	/**
	 * Gets the sort nodes for the class.
	 *
	 * @remarks
	 * This handles the caching of sort nodes on the class. It ensures we
	 * aren't creating them over and over for every request when we know they
	 * won't change unless the process restarts.
	 *
	 * @returns A map from sort names to sort nodes.
	 */
	private static _getSortNodes(): Record<string, SortNode|undefined> {
		let nodes = this._sortNodes;
		if (!nodes) nodes = this._sortNodes = this._createSortNodes();
		return nodes;
	}

	/**
	 * A convenience for accessing the class constructor with all of its type
	 * information intact.
	 *
	 * @remarks
	 * TypeScript is annoying and still types `this.constructor` as `Function`.
	 * I don't know if this will ever change, but this is the best workaround I
	 * can think of right now.
	 */
	private get _cls(): typeof Paginator {
		return this.constructor as typeof Paginator;
	}

	/**
	 * Executes the Paginator, resolving with the fetched Page.
	 *
	 * @remarks
	 * You can keep using the same instance to fetch additional pages, but since
	 * you're usually only fetching one page per request, and you don't want to
	 * store paginator instances between requests, you're usally only going to
	 * call this method once for each instance.
	 *
	 * For this reason, the `::getPage` static method is included to create and
	 * execute a query in a single call.
	 *
	 * @param cursor - The cursor string from the previous page, if any.
	 * @returns The fetched Page.
	 */
	async execute(cursor?: string|null): Promise<Page<TModel>> {
		const qry = this._getQuery(cursor);
		const items = await qry;
		const lastItem = last(items);
		let remaining = 0;

		if (lastItem) {
			remaining = await this._getRemainingCount(qry, items.length);
			cursor = this._createCursorString(lastItem);
		} else if (!cursor) {
			cursor = this._createCursorString();
		}

		return {items, remaining, cursor};
	}

	/**
	 * Fetches the sort node corresponding to the instance's sort name.
	 *
	 * @remarks
	 * This method will throw an UnknownSortError if the corresponding sort node
	 * does not exist. This means that the sort name is not actually checked
	 * until you actually attempt to execute the paginator.
	 *
	 * @returns The fetched sort node.
	 */
	private _getSortNode(): SortNode {
		// eslint-disable-next-line no-underscore-dangle
		const node = this._cls._getSortNodes()[this.sort];
		if (node) return node;
		throw new UnknownSortError({info: {sort: this.sort}});
	}

	/**
	 * Creates a cursor for this subtype.
	 *
	 * @remarks
	 * If provided with an item, the cursor will include values so that the next
	 * page fetched with the cursor will include items *after* this value. This
	 * is used to create cursors from the last fetched item in a page.
	 *
	 * If not provided with an item, the cursor will have no values, and using
	 * it will simply resume from the beginning of the sort. This is used to
	 * create cursors for initial queries that come back empty, meaning there's
	 * nothing that matches it yet.
	 *
	 * @param item - The model instance to resume from, if any.
	 * @returns The created cursor object.
	 */
	private _createCursor(item?: TModel): Cursor {
		return new Cursor(
			// eslint-disable-next-line no-underscore-dangle
			this._cls._getQueryName(),
			this.sort,
			item && this._getSortNode().getCursorValues(item),
		);
	}

	/**
	 * Creates a cursor string for this subtype.
	 *
	 * @remarks
	 * This method is the same as #_createCursor, except that it serializes
	 * the cursor object before returning it.
	 *
	 * @param item - The model instance to resume from, if any.
	 */
	private _createCursorString(item?: TModel): string {
		return this._createCursor(item).serialize();
	}

	/**
	 * Validates a cursor object against the paginator instance.
	 *
	 * @remarks
	 * This method is responsible for checking the query name and sort name of
	 * the provided cursor. It will throw an InvalidCursorError if any problems
	 * are found.
	 *
	 * @param cursor - The unmutated cursor object.
	 */
	private _validateCursor(cursor: Cursor): Cursor {
		// eslint-disable-next-line no-underscore-dangle
		const queryName = this._cls._getQueryName();
		if (cursor.query !== queryName) {
			throw new InvalidCursorError({
				shortMessage: "Cursor is for a different query",
				info: {
					cursorQuery: cursor.query,
					expectedQuery: queryName,
				},
			});
		}

		if (cursor.sort !== this.sort) {
			throw new InvalidCursorError({
				shortMessage: "Cursor is for a different sort",
				info: {
					cursorSort: cursor.sort,
					expectedSort: this.sort,
				},
			});
		}

		return cursor;
	}

	/**
	 * Parses and validates a cursor string.
	 * @param str - The encoded cursor string.
	 * @returns The parsed cursor.
	 */
	private _parseCursor(str: string): Cursor {
		return this._validateCursor(Cursor.parse(str));
	}

	/**
	 * Extracts the values, if any, from an optional cursor string.
	 * @param str - The encoded cursor string, if any.
	 * @returns The cursor values, or undefined if there are none.
	 */
	private _getCursorValues(str?: string|null): any[] | undefined {
		if (!isNil(str)) return this._parseCursor(str).values;
	}

	/**
	 * Applies the sort node for this paginator instance to the provided
	 * Objection query builder.
	 *
	 * @remarks
	 * Note that this method mutates the query builder.
	 *
	 * @param qry - The query builder to mutate.
	 * @param cursor - The cursor string from the last page, if any.
	 */
	private _applySortNode(qry: QueryBuilder<TModel>, cursor?: string|null): void {
		this._getSortNode().apply(qry, this._getCursorValues(cursor));
	}

	/**
	 * Applies the limit for this paginator instance to the provided Objection
	 * query builder.
	 *
	 * @remarks
	 * Note that this method mutates the query builder.
	 *
	 * @param qry - The query builder to mutate.
	 */
	private _applyLimit(qry: QueryBuilder<TModel>): void {
		qry.limit(this.limit);
	}

	/**
	 * Creates the final query for this paginator instance.
	 *
	 * @remarks
	 * This is called during #execute to create the full query builder to get
	 * the page, before executing. It fetches the user-defined base query and
	 * applies both the sort node and the limit to it.
	 *
	 * @param cursor - The cursor string from the last page, if any.
	 * @returns The final query to execute.
	 */
	private _getQuery(cursor?: string|null): QueryBuilder<TModel> {
		const qry = this.getBaseQuery();
		this._applySortNode(qry, cursor);
		this._applyLimit(qry);
		return qry;
	}

	/**
	 * Queries the database for the number of items left after this page.
	 *
	 * @remarks
	 * The `resultSize` query used below could possibly be parallelized with the
	 * original query, but it can possibly rely on metadata about related tables
	 * that Objection may or may not have built before the initial query is
	 * executed. To avoid metadata-related errors, we do both queries in series.
	 *
	 * We could allow users to use `Objection.initialize` to force the metadata
	 * to be loaded ahead of time, and then send a flag to their Paginators to
	 * do the queries in parallel, but it seems like a micro-optimization.
	 *
	 * Additionally, performing the queries in series allows us to do other
	 * optimizations, such as eliminating the resultSize query entirely
	 * depending on the number of items fetched. If got back fewer items than
	 * the limit, for example, we can assume that we've reached the end of the
	 * result set and just return zero without doing a second query.
	 *
	 * @param qry - The original query builder, *after* execution.
	 * @param itemCount - The nubmer of items found for this page.
	 */
	private async _getRemainingCount(
		qry: QueryBuilder<TModel>,
		itemCount: number,
	): Promise<number> {
		if (itemCount < this.limit) return 0;
		return await qry.resultSize() - itemCount;
	}

	/**
	 * Returns an Objection QueryBuilder which will match the entire result set
	 * of the paginator.
	 *
	 * @remarks
	 * An implementation for this method must be provided in all concrete
	 * subtypes. Typically, you'll want to return a plain, unaltered query on
	 * your model, though sometimes you'll want to apply your own filters or
	 * load related data using Objection's awesome relationship features.
	 *
	 * You should absolutely *not* mark this method as `async`, or otherwise
	 * invoke the `then` or `catch` methods of the query builder. You want to
	 * return the un-executed builder as-is, so that the paginator can work its
	 * magic and apply all the necessary orderBy and where clauses before
	 * execution.
	 */
	abstract getBaseQuery(): QueryBuilder<TModel>;
}
