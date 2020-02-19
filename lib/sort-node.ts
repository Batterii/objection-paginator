import { Model, OrderByDescriptor, QueryBuilder } from 'objection';
import { ConcreteSortDescriptor } from './concrete-sort-descriptor';
import { SortDirection } from './sort-descriptor';
import { ValidationCase } from './get-error-class';
import { isEmpty } from 'lodash';

/**
 * An internal class used to apply sorting and cursor filters to Objection
 * query builder.
 *
 * @remarks
 * This class is implemented as a linked list, largely because filtering
 * expressions for cursors against many-column sorts can get real complicated
 * real fast, and they are best handled and reasoned-about recursively.
 *
 * A single sort node represents sorting by a single column, while a node with
 * a child indicates a single column sort with at least one subsort.
 */
export class SortNode {
	/**
	 * The sort descriptor for the node.
	 */
	descriptor: ConcreteSortDescriptor;

	/**
	 * The child node for subsorts, if any.
	 */
	child?: SortNode;

	/**
	 * Will be true if any descriptor specified a nullable column.
	 *
	 * @remarks
	 * This is necessary because the Knex query builder does not support
	 * specifying how to handle nulls with its orderBy method. If any columns
	 * in the sort are nullable, the order must be specified using raw SQL.
	 */
	anyNullable: boolean;

	/**
	 * Creates a SortNode.
	 * @param descriptors - The concrete sort descriptors, created from the
	 *   user-specified sort configuration.
	 */
	constructor(descriptors: ConcreteSortDescriptor[]) {
		const [ firstDescriptor ] = descriptors;
		if (!firstDescriptor) {
			throw new TypeError('At least one sort descriptor is required');
		}
		this.descriptor = firstDescriptor;
		this.anyNullable = firstDescriptor.nullable;

		const subdescriptors = descriptors.slice(1);
		if (!isEmpty(subdescriptors)) {
			this.child = new SortNode(subdescriptors);
			this.anyNullable = this.anyNullable || this.child.anyNullable;
		}
	}

	/**
	 * Applies the node and all of its children to the provided query builder,
	 * with optional cursor values.
	 *
	 * @remarks
	 * This method will handle all of the ordering and filtering expressions
	 * necessary for getting the page, though the limit is handled in the
	 * Paginator class itself.
	 *
	 * Note that this method mutates the provided builder, but does not mutate
	 * the node.
	 *
	 * @param qry - The query builder.
	 * @param cursorValues - The cursor values for resuming a paginated query.
	 *   If not provided, the page will be fetched from the beginning of the
	 *   sort.
	 */
	apply(qry: QueryBuilder<Model>, cursorValues?: any[]): void {
		this.applyOrder(qry);
		if (cursorValues) this.applyCursorValues(qry, cursorValues);
	}

	/**
	 * Adds an order specifier to the provided query.
	 *
	 * @remarks
	 * This method will use either a Knex orderBy expression, or specify the
	 * order in raw sql, depending on whether any columns in the sort are
	 * nullable.
	 *
	 * This method mutates the provided query.
	 *
	 * @param qry - The query to which to apply an order.
	 */
	applyOrder(qry: QueryBuilder<Model>): void {
		if (this.anyNullable) {
			qry.orderByRaw(this.getOrderByClause());
		} else {
			qry.orderBy(this.getOrderByDescriptors());
		}
	}

	/**
	 * Gets the Objection orderBy descriptors for this node and all of its
	 * subsorts.
	 * @returns The orderBy descriptors, which can be provided directly to tfhe
	 *    builder's #orderBy method.
	 */
	getOrderByDescriptors(): OrderByDescriptor[] {
		const { descriptor, child } = this;
		const { column, order } = descriptor;
		const result: OrderByDescriptor[] = [ { column, order } ];
		if (child) result.push(...child.getOrderByDescriptors());
		return result;
	}

	/**
	 * Returns a raw ORDER BY clause for this node and all of its subsorts.
	 * @returns The ORDER BY clause in raw SQL.
	 */
	getOrderByClause(): string {
		return this.getOrderByTerms().join(', ');
	}

	/**
	 * Gets the raw ORDER BY terms for this node and all of its subsorts.
	 * @returns The ORDER BY terms in raw SQL.
	 */
	getOrderByTerms(): string[] {
		const terms = this.getOwnOrderByTerms();
		if (this.child) terms.push(...this.child.getOrderByTerms());
		return terms;
	}

	/**
	 * Gets the raw ORDER BY terms for this node alone.
	 *
	 * @remarks
	 * A nullable column will need to return more than just one term, so that
	 * we can explicitly tell the database how nulls should be sorted instead of
	 * leaving it to inconsistent defaults.
	 *
	 * @returns The ORDER BY terms in raw SQL.
	 */
	getOwnOrderByTerms(): string[] {
		const { column, order, nullable, nullOrder } = this.descriptor;
		const terms = [ `${column} ${order}` ];
		if (nullable) terms.unshift(`(${column} is null) ${nullOrder}`);
		return terms;
	}

	/**
	 * Extracts cursor values from an entity for this node and all of its
	 * subsorts.
	 *
	 * @remarks
	 * This is used to create a cursor from the final item returned in a page.
	 * If applied to a future query, these cursor values will filter out that
	 * final item, as well as any items before it in the sort.
	 *
	 * Cursor values are validated as they are extracted. If problem is found,
	 * this method will throw a ConfigurationError.
	 *
	 * @param entity - The final enntity of the page.
	 */
	getCursorValues(entity: object): any[] {
		const { descriptor, child } = this;
		const result = [ descriptor.getCursorValue(entity) ];
		if (child) result.push(...child.getCursorValues(entity));
		return result;
	}

	/**
	 * Adds filter expressions for the node and all of its subsorts to the
	 * provided query, based on the provided cursor values,
	 *
	 * @remarks
	 * The inverse of `#getCursorValues`, this method is used to consume a
	 * cursor by filtering out the final item in a page and any values ocurring
	 * before it in the sort.
	 *
	 * Cursor values are validated as they are applied. If a problem is found,
	 * this method will throw an InvalidCursorError.
	 *
	 * Note that this method mutates the provided query builder, but does not
	 * mutate the node.
	 *
	 * @param qry - The query builder to mutate.
	 * @param values - The cursor values to apply.
	 */
	applyCursorValues(qry: QueryBuilder<Model>, values: any[]): void {
		const [ value ] = values;
		const childValues = values.slice(1);
		this.descriptor.validateCursorValue(value, ValidationCase.Cursor);
		if (value === null) {
			this.applyNullCursorValue(qry, childValues);
		} else {
			this.applyCursorValue(qry, value, childValues);
		}
	}

	/**
	 * Adds the provided non-null cursor value as a filter on the provided
	 * query builder.
	 *
	 * @remarks
	 * If the node has a child, child cursor values will be applied recursively
	 * through that child.
	 *
	 * This method is for non-null cursor values only. Null cursor values should
	 * use `#applyNullCursorValue` instead.
	 *
	 * This method mutates the provided query builder.
	 *
	 * @param qry - The query to which to apply filters.
	 * @param value - The current cursor value.
	 * @param childValues - Cursor values for child nodes, if any.
	 */
	applyCursorValue(
		qry: QueryBuilder<Model>,
		value: any,
		childValues: any[],
	): void {
		const { descriptor, child } = this;
		const { column } = descriptor;
		if (child) {
			qry.where((sub0) => {
				sub0
					.where((sub1) => {
						this.applyInequality(sub1, value);
					})
					.orWhere((sub1) => {
						sub1.where({ [column]: value });
						child.applyCursorValues(sub1, childValues);
					});
			});
		} else {
			this.applyInequality(qry, value);
		}
	}

	/**
	 * Applies null as a cursor value filter on the provided query builder.
	 *
	 * @remarks
	 * If the node has a child, child cursor values will be applied recursively
	 * through that child.
	 *
	 * This method mutates the provided query builder.
	 *
	 * @param qry - The query to which to apply filters
	 * @param childValues - Cursor values for child nodes, if any.
	 */
	applyNullCursorValue(qry: QueryBuilder<Model>, childValues: any[]): void {
		const { descriptor, child } = this;
		const { column, direction } = descriptor;
		if (child) {
			this.applyNullCursorValueWithChildren(qry, childValues);
		} else if (direction !== SortDirection.Descending) {
			qry.whereNull(column);
		}
	}

	/**
	 * Modifies a query to filter out items with values before the provided
	 * value in the sort.
	 *
	 * @remarks
	 * This method mutates the provided query builder.
	 *
	 * @param qry - The query builder to mutate.
	 * @param value - The value for the inequality filter.
	 */
	applyInequality(qry: QueryBuilder<Model>, value: any): void {
		const { column, operator, nullable } = this.descriptor;
		qry.where(column, operator, value);
		if (nullable) this.handleNulls(qry);
	}

	/**
	 * Modifies a query to account for nulls, following an inequality filter.
	 *
	 * @remarks
	 * In SQL, null values fail all inequalty expressions, so an inequality
	 * filter will always screen out all nulls. This method is invoked following
	 * the application of an inequality filter on a nullable column, to ensure
	 * that nulls are also included, if they should be based on the sort
	 * direction.
	 *
	 * This method may mutate the provided query builder.
	 *
	 * @param qry - The query builder to which an inequality filter was added.
	 */
	handleNulls(qry: QueryBuilder<Model>): void {
		const { column, direction } = this.descriptor;
		if (direction !== SortDirection.Descending) qry.orWhereNull(column);
	}

	/**
	 * Applies null as a cursor value filter on the provided query builder,
	 * assuming the node has a child.
	 *
	 * @remarks
	 * This method assumes the child exists and will throw if it doesn't. It
	 * exists separately from the `#applyNullCursorValue` method largely to
	 * simplify tests.
	 *
	 * @param qry - The query to which to apply filters
	 * @param childValues - Cursor values for child nodes, if any.
	 */
	applyNullCursorValueWithChildren(
		qry: QueryBuilder<Model>,
		childValues: any[],
	): void {
		const { descriptor, child } = this as Required<SortNode>;
		const { column, direction } = descriptor;
		if (direction === SortDirection.Descending) {
			qry.whereNotNull(column).orWhere((sub) => {
				sub.whereNull(column);
				child.applyCursorValues(sub, childValues);
			});
		} else {
			qry.whereNull(column);
			child.applyCursorValues(qry, childValues);
		}
	}
}
