import { ConcreteSortDescriptor } from './concrete-sort-descriptor';
import { SortDescriptor } from './sort-descriptor';
import { SortNode } from './sort-node';

export function createSortNode(descriptors: SortDescriptor[]): SortNode {
	return new SortNode(descriptors.map((d) => new ConcreteSortDescriptor(d)));
}
