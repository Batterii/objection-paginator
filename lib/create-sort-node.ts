import {ConcreteSortDescriptor} from "./concrete-sort-descriptor";
import {SortDescriptor} from "./sort-descriptor";
import {SortNode} from "./sort-node";

/**
 * An internal function that creates a SortNode from a user-specifed sort.
 * @param descriptors - The array of user-specified sort descriptors.
 * @returns The created SortNode.
 */
export function createSortNode(
	descriptors: (SortDescriptor|string)[],
): SortNode {
	return new SortNode(descriptors.map((d) => new ConcreteSortDescriptor(d)));
}
