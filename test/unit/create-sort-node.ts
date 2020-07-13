import * as concreteDescriptorModule from "../../lib/concrete-sort-descriptor";
import * as nodeModule from "../../lib/sort-node";
import {SortDescriptor} from "../../lib/sort-descriptor";
import {createSortNode} from "../../lib/create-sort-node";
import {expect} from "chai";
import sinon from "sinon";

type ConcreteSortDescriptor = concreteDescriptorModule.ConcreteSortDescriptor;
type SortNode = nodeModule.SortNode;

describe("createSortNode", function() {
	let d1: SortDescriptor;
	let d2: SortDescriptor;
	let c1: ConcreteSortDescriptor;
	let c2: ConcreteSortDescriptor;
	let ConcreteSortDescriptor: sinon.SinonStub;
	let node: SortNode;
	let SortNode: sinon.SinonStub;
	let result: SortNode;

	beforeEach(function() {
		d1 = {} as SortDescriptor;
		d2 = {} as SortDescriptor;
		c1 = {} as ConcreteSortDescriptor;
		c2 = {} as ConcreteSortDescriptor;
		ConcreteSortDescriptor = sinon.stub(
			concreteDescriptorModule,
			"ConcreteSortDescriptor",
		);
		ConcreteSortDescriptor
			.withArgs(sinon.match.same(d1)).returns(c1)
			.withArgs(sinon.match.same(d2)).returns(c2);
		node = {} as SortNode;
		SortNode = sinon.stub(nodeModule, "SortNode").returns(node);

		result = createSortNode([d1, d2]);
	});

	it("creates a concrete descriptor from each provided descriptor", function() {
		expect(ConcreteSortDescriptor).to.be.calledTwice;
		expect(ConcreteSortDescriptor).to.always.be.calledWithNew;
		expect(ConcreteSortDescriptor).to.be.calledWith(sinon.match.same(d1));
		expect(ConcreteSortDescriptor).to.be.calledWith(sinon.match.same(d2));
	});

	it("creates a sort node from the created concrete descriptors", function() {
		expect(SortNode).to.be.calledOnce;
		expect(SortNode).to.be.calledWithNew;
		expect(SortNode).to.be.calledWith([
			sinon.match.same(c1),
			sinon.match.same(c2),
		]);
	});

	it("returns the created sort node", function() {
		expect(result).to.equal(node);
	});
});
