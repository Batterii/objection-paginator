import { Model, OrderByDescriptor, QueryBuilder } from 'objection';
import { ConcreteSortDescriptor } from './concrete-sort-descriptor';
import { ConfigurationError } from './configuration-error';
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
	 * Creates a SortNode.
	 * @param descriptors - The concrete sort descriptors, created from the
	 *   user-specified sort configuration.
	 */
	constructor(descriptors: ConcreteSortDescriptor[]) {
		// Extract and store the first descriptor.
		const [ firstDescriptor ] = descriptors;
		if (!firstDescriptor) {
			throw new ConfigurationError(
				'At least one sort descriptor is required',
			);
		}
		this.descriptor = firstDescriptor;

		// Create a child node with any remaining descriptors.
		const subdescriptors = descriptors.slice(1);
		if (!isEmpty(subdescriptors)) {
			this.child = new SortNode(subdescriptors);
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
		qry.orderBy(this.getOrderByDescriptors());
		if (cursorValues) this.applyCursorValues(qry, cursorValues);
	}

	/**
	 * Gets the Objection orderBy descriptors for this node and all of its
	 * subsorts.
	 * @returns The orderBy descriptors, which can be provided directly to the
	 *    builder's #orderBy method.
	 */
	getOrderByDescriptors(): OrderByDescriptor[] {
		const { descriptor, child } = this;
		const { column, direction } = descriptor;
		const result: OrderByDescriptor[] = [ { column, order: direction } ];
		if (child) result.push(...child.getOrderByDescriptors());
		return result;
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
		// Get the descriptor and child.
		const { descriptor, child } = this;

		// Get column name, inequality operator, and next cursor value.
		const { column } = descriptor;
		const operator = descriptor.getOperator();
		const [ value ] = values;

		// Validate the cursor value.
		descriptor.validateCursorValue(value, ValidationCase.Cursor);

		if (child) {
			// Handle the child recursively.
			qry.where((sub0) => {
				// "Or" the inequality with a nested expression.
				sub0.where(column, operator, value).orWhere((sub1) => {
					// Check for equivalence, along with filters for the child.
					sub1.where({ [column]: value }).andWhere((sub2) => {
						child.applyCursorValues(sub2, values.slice(1));
					});
				});
			});
		} else {
			// The final node can be the inequality by itself.
			qry.where(column, operator, value);
		}
	}
}
