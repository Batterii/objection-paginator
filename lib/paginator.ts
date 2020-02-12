import { Model, QueryBuilder } from 'objection';
import { isObject, last, mapValues, omit } from 'lodash';
import { Cursor } from './cursor';
import { InvalidCursorError } from './invalid-cursor-error';
import { SortDescriptor } from './sort-descriptor';
import { SortNode } from './sort-node';
import { UnknownSortError } from './unknown-sort-error';
import { createSortNode } from './create-sort-node';
import { MD5 as md5 } from 'object-hash';

export interface PaginatorOptions {
	limit?: number;
	sort?: string;
}

export interface GetPageOptions extends PaginatorOptions {
	cursor?: string;
}

export interface Page<T extends Model> {
	items: T[];
	remaining: number;
	cursor: string;
}

type If<T> = T extends undefined ? [] : [T];

interface PaginatorConstructor<TModel extends Model, TArgs = undefined> {
	new (
		options?: PaginatorOptions,
		...rest: If<TArgs>
	): Paginator<TModel, TArgs>;
}

export abstract class Paginator<TModel extends Model, TArgs = undefined> {
	static sorts?: Record<string, (SortDescriptor|string)[]>;
	static queryName?: string;
	static varyArgs?: string[];
	private static _sortNodes?: Record<string, SortNode|undefined>;

	readonly limit: number;
	readonly sort: string;
	readonly args: TArgs;

	constructor(options: PaginatorOptions = {}, ...rest: If<TArgs>) {
		const { limit, sort } = options;
		Object.defineProperties(this, {
			limit: { value: limit || 1000, enumerable: true },
			sort: { value: sort || 'default', enumerable: true },
			args: { value: rest[0], enumerable: true },
		});
	}

	static async getPage<TModel extends Model, TArgs = undefined>(
		this: PaginatorConstructor<TModel, TArgs>,
		options?: GetPageOptions,
		...rest: If<TArgs>
	): Promise<Page<TModel>> {
		return new this(options, ...rest).execute(options && options.cursor);
	}

	private static _getQueryName(): string {
		return this.queryName || this.name;
	}

	private static _createSortNodes(): Record<string, SortNode> {
		return this.sorts ? mapValues(this.sorts, createSortNode) : {};
	}

	private static _getSortNodes(): Record<string, SortNode|undefined> {
		let nodes = this._sortNodes;
		if (!nodes) nodes = this._sortNodes = this._createSortNodes();
		return nodes;
	}

	private get _cls(): typeof Paginator {
		return this.constructor as typeof Paginator;
	}

	async execute(cursor?: string): Promise<Page<TModel>> {
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

		return { items, remaining, cursor };
	}

	private _getSortNode(): SortNode {
		// eslint-disable-next-line no-underscore-dangle
		const node = this._cls._getSortNodes()[this.sort];
		if (node) return node;
		throw new UnknownSortError({ info: { sort: this.sort } });
	}

	private _getArgsHash(): string|undefined {
		let args = this.args as any;
		if (args === undefined) return;
		const { varyArgs } = this._cls;
		if (varyArgs && isObject(args)) args = omit(args, varyArgs);
		return md5(args);
	}

	private _createCursor(item?: TModel): Cursor {
		return new Cursor(
			// eslint-disable-next-line no-underscore-dangle
			this._cls._getQueryName(),
			this.sort,
			item && this._getSortNode().getCursorValues(item),
			this._getArgsHash(),
		);
	}

	private _createCursorString(item?: TModel): string {
		return this._createCursor(item).serialize();
	}

	private _validateCursor(cursor: Cursor): Cursor {
		// eslint-disable-next-line no-underscore-dangle
		const queryName = this._cls._getQueryName();
		if (cursor.query !== queryName) {
			throw new InvalidCursorError({
				shortMessage: 'Cursor is for a different query',
				info: {
					cursorQuery: cursor.query,
					expectedQuery: queryName,
				},
			});
		}

		if (cursor.sort !== this.sort) {
			throw new InvalidCursorError({
				shortMessage: 'Cursor is for a different sort',
				info: {
					cursorSort: cursor.sort,
					expectedSort: this.sort,
				},
			});
		}

		if (cursor.argsHash !== this._getArgsHash()) {
			throw new InvalidCursorError(
				'Args hash mismatch',
				{ info: { expectedArgs: this.args } },
			);
		}

		return cursor;
	}

	private _parseCursor(str: string): Cursor {
		return this._validateCursor(Cursor.parse(str));
	}

	private _getCursorValues(str?: string): any[] | undefined {
		if (str !== undefined) return this._parseCursor(str).values;
	}

	private _applySortNode(qry: QueryBuilder<TModel>, cursor?: string): void {
		this._getSortNode().apply(qry, this._getCursorValues(cursor));
	}

	private _applyLimit(qry: QueryBuilder<TModel>): void {
		qry.limit(this.limit);
	}

	private _getQuery(cursor?: string): QueryBuilder<TModel> {
		const qry = this.getBaseQuery();
		this._applySortNode(qry, cursor);
		this._applyLimit(qry);
		return qry;
	}

	private async _getRemainingCount(
		qry: QueryBuilder<TModel>,
		itemCount: number,
	): Promise<number> {
		if (itemCount < this.limit) return 0;
		return await qry.resultSize() - itemCount;
	}

	abstract getBaseQuery(): QueryBuilder<TModel>;
}
