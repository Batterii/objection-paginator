import {
	CallbackVoid,
	Model,
	OrderByDescriptor,
	QueryBuilder,
} from 'objection';
import { ConcreteSortDescriptor } from '../../lib/concrete-sort-descriptor';
import { ConfigurationError } from '../../lib/configuration-error';
import { FakeQuery } from '@batterii/fake-query';
import { SortDirection } from '../../lib/sort-descriptor';
import { SortNode } from '../../lib/sort-node';
import { expect } from 'chai';
import sinon from 'sinon';

describe('SortNode', function() {
	it('creates a single node from one descriptor', function() {
		const descriptor = {} as ConcreteSortDescriptor;

		const node = new SortNode([ descriptor ]);

		expect(node.descriptor).to.equal(descriptor);
		expect(node.child).to.be.undefined;
	});

	it('creates a chain of nodes from multiple descriptors', function() {
		const d1 = {} as ConcreteSortDescriptor;
		const d2 = {} as ConcreteSortDescriptor;
		const d3 = {} as ConcreteSortDescriptor;

		const node = new SortNode([ d1, d2, d3 ]);

		expect(node.descriptor).to.equal(d1);
		expect(node.child).to.be.an.instanceOf(SortNode);
		expect(node.child!.descriptor).to.equal(d2);
		expect(node.child!.child).to.be.an.instanceOf(SortNode);
		expect(node.child!.child!.descriptor).to.equal(d3);
		expect(node.child!.child!.child).to.be.undefined;
	});

	it('throws if no descriptors are provided', function() {
		expect(() => {
			new SortNode([]); // eslint-disable-line no-new
		}).to.throw(ConfigurationError).that.includes({
			shortMessage: 'At least one sort descriptor is required',
			cause: null,
			info: null,
		});
	});

	describe('#apply', function() {
		let node: SortNode;
		let qry: FakeQuery;
		let orderByDescriptors: OrderByDescriptor[];
		let getOrderByDescriptors: sinon.SinonStub;
		let cursorValues: any[];
		let applyCursorValues: sinon.SinonStub;

		beforeEach(function() {
			node = new SortNode([ {} as ConcreteSortDescriptor ]);
			qry = new FakeQuery();

			orderByDescriptors = [];
			getOrderByDescriptors = sinon.stub(node, 'getOrderByDescriptors')
				.returns(orderByDescriptors);

			cursorValues = [];
			applyCursorValues = sinon.stub(node, 'applyCursorValues');
		});

		it('gets order by descriptors for the node', function() {
			node.apply(qry.builder, cursorValues);

			expect(getOrderByDescriptors).to.be.calledOnce;
			expect(getOrderByDescriptors).to.be.calledOn(node);
		});

		it('applies the orderBy descriptors to the query', function() {
			node.apply(qry.builder, cursorValues);

			expect(qry.stubNames).to.deep.equal([ 'orderBy' ]);
			expect(qry.stubs.orderBy).to.be.calledOnce;
			expect(qry.stubs.orderBy).to.be.calledOn(qry.builder);
			expect(qry.stubs.orderBy).to.be.calledWith(
				sinon.match.same(orderByDescriptors),
			);
		});

		it('appies cursor values to the query', function() {
			node.apply(qry.builder, cursorValues);

			expect(applyCursorValues).to.be.calledOnce;
			expect(applyCursorValues).to.be.calledOn(node);
			expect(applyCursorValues).to.be.calledWith(
				sinon.match.same(qry.builder),
				sinon.match.same(cursorValues),
			);
		});

		it('supports omitting the cursor values', function() {
			node.apply(qry.builder);

			expect(getOrderByDescriptors).to.be.calledOnce;
			expect(getOrderByDescriptors).to.be.calledOn(node);
			expect(qry.stubNames).to.deep.equal([ 'orderBy' ]);
			expect(qry.stubs.orderBy).to.be.calledOnce;
			expect(qry.stubs.orderBy).to.be.calledOn(qry.builder);
			expect(qry.stubs.orderBy).to.be.calledWith(
				sinon.match.same(orderByDescriptors),
			);
			expect(applyCursorValues).to.not.be.called;
		});
	});

	describe('#getOrderByDescriptors', function() {
		const column = 'some column name';
		const direction = 'sort direction' as SortDirection;
		let descriptor: ConcreteSortDescriptor;
		let node: SortNode;

		beforeEach(function() {
			descriptor = { column, direction } as ConcreteSortDescriptor;
			node = new SortNode([ descriptor ]);
		});

		it('returns a descriptor with column and order', function() {
			const result = node.getOrderByDescriptors();

			expect(result).to.deep.equal([ { column, order: direction } ]);
		});

		context('node has a child', function() {
			let child: SortNode;

			beforeEach(function() {
				child = node.child = new SortNode([ {} as any ]);
				sinon.stub(child, 'getOrderByDescriptors')
					.returns([ { foo: 'bar' }, { baz: 'qux' } ] as any);
			});

			it('gets the order by descriptors of the child', function() {
				node.getOrderByDescriptors();

				expect(child.getOrderByDescriptors).to.be.calledOnce;
				expect(child.getOrderByDescriptors).to.be.calledOn(child);
			});

			it('appends child descriptors to the result', function() {
				expect(node.getOrderByDescriptors()).to.deep.equal([
					{ column, order: direction },
					{ foo: 'bar' },
					{ baz: 'qux' },
				]);
			});
		});
	});

	describe('#getCursorValues', function() {
		const value = 'cursor value';
		let descriptor: sinon.SinonStubbedInstance<ConcreteSortDescriptor>;
		let node: SortNode;
		let entity: object;

		beforeEach(function() {
			descriptor = sinon.createStubInstance(ConcreteSortDescriptor);
			descriptor.getCursorValue.returns(value);

			node = new SortNode([ descriptor ]);
			entity = {};
		});

		it('gets the first cursor value from the provided entity', function() {
			node.getCursorValues(entity);

			expect(descriptor.getCursorValue).to.be.calledOnce;
			expect(descriptor.getCursorValue).to.be.calledOn(descriptor);
			expect(descriptor.getCursorValue).to.be.calledWith(
				sinon.match.same(entity),
			);
		});

		it('returns the first cursor value in an array', function() {
			expect(node.getCursorValues(entity)).to.deep.equal([ value ]);
		});

		context('node has a child', function() {
			let child: SortNode;

			beforeEach(function() {
				child = node.child = new SortNode([ {} as any ]);
				sinon.stub(child, 'getCursorValues').returns([ 'foo', 'bar' ]);
			});

			it('gets the cursor values for the child', function() {
				node.getCursorValues(entity);

				expect(child.getCursorValues).to.be.calledOnce;
				expect(child.getCursorValues).to.be.calledOn(child);
				expect(child.getCursorValues).to.be.calledWith(
					sinon.match.same(entity),
				);
			});

			it('appends child cursor values to the result', function() {
				expect(node.getCursorValues(entity)).to.deep.equal([
					value,
					'foo',
					'bar',
				]);
			});
		});
	});

	describe('#applyCursorValues', function() {
		const column = 'column name';
		const operator = 'sort operator';
		const nextValue = 'next cursor value';
		let descriptor: sinon.SinonStubbedInstance<ConcreteSortDescriptor>;
		let node: SortNode;
		let qry: FakeQuery;
		let values: any[];

		beforeEach(function() {
			descriptor = sinon.createStubInstance(ConcreteSortDescriptor);
			descriptor.column = column;
			descriptor.getOperator.returns(operator);
			descriptor.getNextCursorValue.returns(nextValue);

			node = new SortNode([ descriptor ]);
			qry = new FakeQuery();
			values = [ 'foo', 'bar', 'baz' ];
		});

		context('node has no child', function() {
			it('gets the operator from the decriptor', function() {
				node.applyCursorValues(qry.builder, values);

				expect(descriptor.getOperator).to.be.calledOnce;
				expect(descriptor.getOperator).to.be.calledOn(descriptor);
			});

			it('gets the next cursor value using the descriptor', function() {
				node.applyCursorValues(qry.builder, values);

				expect(descriptor.getNextCursorValue).to.be.calledOnce;
				expect(descriptor.getNextCursorValue)
					.to.be.calledOn(descriptor);
				expect(descriptor.getNextCursorValue).to.be.calledWith(values);
			});

			it('applies an inequality where clause to the query builder', function() {
				node.applyCursorValues(qry.builder, values);

				expect(qry.stubNames).to.deep.equal([ 'where' ]);
				expect(qry.stubs.where).to.be.calledOnce;
				expect(qry.stubs.where).to.be.calledOn(qry.builder);
				expect(qry.stubs.where).to.be.calledWith(
					column,
					operator,
					nextValue,
				);
			});
		});

		context('node has a child', function() {
			let child: sinon.SinonStubbedInstance<SortNode>;

			beforeEach(function() {
				child = node.child = sinon.createStubInstance(SortNode);
			});

			it('gets the operator from the decriptor', function() {
				node.applyCursorValues(qry.builder, values);

				expect(descriptor.getOperator).to.be.calledOnce;
				expect(descriptor.getOperator).to.be.calledOn(descriptor);
			});

			it('gets the next cursor value using the descriptor', function() {
				node.applyCursorValues(qry.builder, values);

				expect(descriptor.getNextCursorValue).to.be.calledOnce;
				expect(descriptor.getNextCursorValue)
					.to.be.calledOn(descriptor);
				expect(descriptor.getNextCursorValue).to.be.calledWith(values);
			});

			it('applies a where clause with a callback', function() {
				node.applyCursorValues(qry.builder, values);

				expect(qry.stubNames).to.deep.equal([ 'where' ]);
				expect(qry.stubs.where).to.be.calledOnce;
				expect(qry.stubs.where).to.be.calledOn(qry.builder);
				expect(qry.stubs.where).to.be.calledWith(sinon.match.func);
			});

			describe('where clause callback', function() {
				let cb0: CallbackVoid<QueryBuilder<Model>>;
				let sub0: FakeQuery;

				beforeEach(function() {
					node.applyCursorValues(qry.builder, values);
					const { where } = qry.stubs;
					if (!where) throw new Error('No where stub');
					[ cb0 ] = where.firstCall.args;

					sub0 = new FakeQuery();
				});

				it('applies an inequality where clause with an or callback', function() {
					cb0.call(sub0.builder, sub0.builder);

					expect(sub0.stubNames).to.deep.equal([
						'where',
						'orWhere',
					]);
					expect(sub0.stubs.where).to.be.calledOnce;
					expect(sub0.stubs.where).to.be.calledOn(sub0.builder);
					expect(sub0.stubs.where).to.be.calledWith(
						column,
						operator,
						nextValue,
					);
					expect(sub0.stubs.orWhere).to.be.calledOnce;
					expect(sub0.stubs.orWhere).to.be.calledOn(sub0.builder);
					expect(sub0.stubs.orWhere).to.be.calledWith(
						sinon.match.func,
					);
				});

				describe('or callback', function() {
					let cb1: CallbackVoid<QueryBuilder<Model>>;
					let sub1: FakeQuery;

					beforeEach(function() {
						cb0.call(sub0.builder, sub0.builder);
						const { orWhere } = sub0.stubs;
						if (!orWhere) throw new Error('No orWhere stub');
						[ cb1 ] = orWhere.firstCall.args;

						sub1 = new FakeQuery();
					});

					it('applies an equality where clause with an and callback', function() {
						cb1.call(sub1.builder, sub1.builder);

						expect(sub1.stubNames).to.deep.equal([
							'where',
							'andWhere',
						]);
						expect(sub1.stubs.where).to.be.calledOnce;
						expect(sub1.stubs.where).to.be.calledOn(sub1.builder);
						expect(sub1.stubs.where).to.be.calledWith({
							[column]: nextValue,
						});
						expect(sub1.stubs.andWhere).to.be.calledOnce;
						expect(sub1.stubs.andWhere)
							.to.be.calledOn(sub1.builder);
						expect(sub1.stubs.andWhere).to.be.calledWith(
							sinon.match.func,
						);
					});

					describe('and callback', function() {
						let cb2: CallbackVoid<QueryBuilder<Model>>;
						let sub2: QueryBuilder<Model>;

						beforeEach(function() {
							cb1.call(sub1.builder, sub1.builder);
							const { andWhere } = sub1.stubs;
							if (!andWhere) throw new Error('No andWhere stub');
							[ cb2 ] = andWhere.firstCall.args;

							sub2 = {} as QueryBuilder<Model>;
						});

						it('applies remaining cursor values with the child', function() {
							cb2.call(sub2, sub2);

							expect(child.applyCursorValues).to.be.calledOnce;
							expect(child.applyCursorValues)
								.to.be.calledOn(child);
							expect(child.applyCursorValues).to.be.calledWith(
								sinon.match.same(sub2),
								[ 'bar', 'baz' ],
							);
						});
					});
				});
			});
		});
	});
});
