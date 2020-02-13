import { Model, OrderByDescriptor, QueryBuilder } from 'objection';
import { ConcreteSortDescriptor } from './concrete-sort-descriptor';
import { ConfigurationError } from './configuration-error';
import { ValidationCase } from './get-error-class';
import { isEmpty } from 'lodash';

export class SortNode {
	descriptor: ConcreteSortDescriptor;
	child?: SortNode;

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

	apply(qry: QueryBuilder<Model>, cursorValues?: any[]): void {
		qry.orderBy(this.getOrderByDescriptors());
		if (cursorValues) this.applyCursorValues(qry, cursorValues);
	}

	getOrderByDescriptors(): OrderByDescriptor[] {
		const { descriptor, child } = this;
		const { column, direction } = descriptor;
		const result: OrderByDescriptor[] = [ { column, order: direction } ];
		if (child) result.push(...child.getOrderByDescriptors());
		return result;
	}

	getCursorValues(entity: object): any[] {
		const { descriptor, child } = this;
		const result = [ descriptor.getCursorValue(entity) ];
		if (child) result.push(...child.getCursorValues(entity));
		return result;
	}

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
