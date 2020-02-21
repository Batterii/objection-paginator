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
import { ValidationCase } from '../../lib/get-error-class';
import { expect } from 'chai';
import sinon from 'sinon';

describe('SortNode', function() {
	it('creates a single node from one descriptor', function() {
		const descriptor = { nullable: false } as ConcreteSortDescriptor;

		const node = new SortNode([ descriptor ]);

		expect(node.descriptor).to.equal(descriptor);
		expect(node.child).to.be.undefined;
		expect(node.anyNullable).to.be.false;
	});

	it('creates a chain of nodes from multiple descriptors', function() {
		const d1 = { nullable: false } as ConcreteSortDescriptor;
		const d2 = { nullable: false } as ConcreteSortDescriptor;
		const d3 = { nullable: false } as ConcreteSortDescriptor;

		const node = new SortNode([ d1, d2, d3 ]);

		expect(node.descriptor).to.equal(d1);
		expect(node.child).to.be.an.instanceOf(SortNode);
		expect(node.anyNullable).to.be.false;
		expect(node.child!.descriptor).to.equal(d2);
		expect(node.child!.anyNullable).to.be.false;
		expect(node.child!.child).to.be.an.instanceOf(SortNode);
		expect(node.child!.child!.descriptor).to.equal(d3);
		expect(node.child!.child!.anyNullable).to.be.false;
		expect(node.child!.child!.child).to.be.undefined;
	});

	it('sets anyNullable to true if the only descriptor is nullable', function() {
		const descriptor = { nullable: true } as ConcreteSortDescriptor;

		const node = new SortNode([ descriptor ]);

		expect(node.descriptor).to.equal(descriptor);
		expect(node.anyNullable).to.be.true;
	});

	it('sets anyNullable to true if the first descriptor is nullable', function() {
		const d1 = { nullable: true } as ConcreteSortDescriptor;
		const d2 = { nullable: false } as ConcreteSortDescriptor;
		const d3 = { nullable: false } as ConcreteSortDescriptor;

		const node = new SortNode([ d1, d2, d3 ]);

		expect(node.anyNullable).to.be.true;
		expect(node.child!.anyNullable).to.be.false;
		expect(node.child!.child!.anyNullable).to.be.false;
	});

	it('sets anyNullable to true if a child descriptor is nullable', function() {
		const d1 = { nullable: false } as ConcreteSortDescriptor;
		const d2 = { nullable: true } as ConcreteSortDescriptor;
		const d3 = { nullable: false } as ConcreteSortDescriptor;

		const node = new SortNode([ d1, d2, d3 ]);

		expect(node.anyNullable).to.be.true;
		expect(node.child!.anyNullable).to.be.true;
		expect(node.child!.child!.anyNullable).to.be.false;
	});

	it('throws if no descriptors are provided', function() {
		expect(() => {
			new SortNode([]); // eslint-disable-line no-new
		}).to.throw(ConfigurationError).that.includes({
			message: 'At least one sort descriptor is required',
		});
	});

	describe('#apply', function() {
		let node: SortNode;
		let qry: FakeQuery;
		let cursorValues: any[];
		let applyOrder: sinon.SinonStub;
		let applyCursorValues: sinon.SinonStub;

		beforeEach(function() {
			node = new SortNode([ {} as ConcreteSortDescriptor ]);
			qry = new FakeQuery();
			cursorValues = [];

			applyOrder = sinon.stub(node, 'applyOrder');
			applyCursorValues = sinon.stub(node, 'applyCursorValues');
		});

		it('applies the order to the provided query builder', function() {
			node.apply(qry.builder, cursorValues);

			expect(applyOrder).to.be.calledOnce;
			expect(applyOrder).to.be.calledOn(node);
			expect(applyOrder).to.be.calledWith(sinon.match.same(qry.builder));
		});

		it('applies cursor values to the provided query builder', function() {
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

			expect(applyOrder).to.be.calledOnce;
			expect(applyOrder).to.be.calledOn(node);
			expect(applyOrder).to.be.calledWith(sinon.match.same(qry.builder));
			expect(applyCursorValues).to.not.be.called;
		});
	});

	describe('#applyOrder', function() {
		const orderByClause = 'order by clause';
		let node: SortNode;
		let qry: FakeQuery;
		let orderByDescriptors: OrderByDescriptor[];
		let getOrderByDescriptors: sinon.SinonStub;
		let getOrderByClause: sinon.SinonStub;

		beforeEach(function() {
			node = new SortNode([ {} as ConcreteSortDescriptor ]);
			qry = new FakeQuery();

			orderByDescriptors = [];
			getOrderByDescriptors = sinon.stub(node, 'getOrderByDescriptors')
				.returns(orderByDescriptors);

			getOrderByClause = sinon.stub(node, 'getOrderByClause')
				.returns(orderByClause);
		});

		it('gets order by descriptors for the node', function() {
			node.applyOrder(qry.builder);

			expect(getOrderByDescriptors).to.be.calledOnce;
			expect(getOrderByDescriptors).to.be.calledOn(node);
		});

		it('applies the order by descriptors to the provided query builder', function() {
			node.applyOrder(qry.builder);

			expect(qry.stubNames).to.deep.equal([ 'orderBy' ]);
			expect(qry.stubs.orderBy).to.be.calledOnce;
			expect(qry.stubs.orderBy).to.be.calledOn(qry.builder);
			expect(qry.stubs.orderBy).to.be.calledWith(
				sinon.match.same(orderByDescriptors),
			);
		});

		context('anyNullable is true', function() {
			beforeEach(function() {
				node.anyNullable = true;
			});

			it('gets the raw order by clause, passing the query builder', function() {
				node.applyOrder(qry.builder);

				expect(getOrderByClause).to.be.calledOnce;
				expect(getOrderByClause).to.be.calledOn(node);
				expect(getOrderByClause).to.be.calledWith(
					sinon.match.same(qry.builder),
				);
			});

			it('it applies the raw order by clause to the provided query builder', function() {
				node.applyOrder(qry.builder);

				expect(qry.stubNames).to.deep.equal([ 'orderByRaw' ]);
				expect(qry.stubs.orderByRaw).to.be.calledOnce;
				expect(qry.stubs.orderByRaw).to.be.calledOn(qry.builder);
				expect(qry.stubs.orderByRaw).to.be.calledWith(orderByClause);
			});
		});
	});

	describe('#getOrderByDescriptors', function() {
		const column = 'some column name';
		const order = 'sort order' as 'asc'|'desc';
		let descriptor: ConcreteSortDescriptor;
		let node: SortNode;

		beforeEach(function() {
			descriptor = { column, order } as ConcreteSortDescriptor;
			node = new SortNode([ descriptor ]);
		});

		it('returns a descriptor with column and order', function() {
			const result = node.getOrderByDescriptors();

			expect(result).to.deep.equal([ { column, order } ]);
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
					{ column, order },
					{ foo: 'bar' },
					{ baz: 'qux' },
				]);
			});
		});
	});

	describe('#getOrderByClause', function() {
		let node: SortNode;
		let qry: QueryBuilder<Model>;
		let getOrderByTerms: sinon.SinonStub;

		beforeEach(function() {
			node = new SortNode([ {} as any ]);
			qry = {} as QueryBuilder<Model>;
			getOrderByTerms = sinon.stub(node, 'getOrderByTerms')
				.returns([ 'foo', 'bar', 'baz' ]);
		});

		it('gets the order by terms for this node, passing the query builder', function() {
			node.getOrderByClause(qry);

			expect(getOrderByTerms).to.be.calledOnce;
			expect(getOrderByTerms).to.be.calledOn(node);
			expect(getOrderByTerms).to.be.calledWith(sinon.match.same(qry));
		});

		it('returns order by terms joined by commas and spaces', function() {
			expect(node.getOrderByClause(qry)).to.equal('foo, bar, baz');
		});
	});

	describe('#getOrderByTerms', function() {
		let descriptor: ConcreteSortDescriptor;
		let node: SortNode;
		let qry: QueryBuilder<Model>;
		let getOwnOrderByTerms: sinon.SinonStub;

		beforeEach(function() {
			descriptor = {} as ConcreteSortDescriptor;
			node = new SortNode([ descriptor ]);
			qry = {} as QueryBuilder<Model>;
			getOwnOrderByTerms = sinon.stub(node, 'getOwnOrderByTerms')
				.returns([ 'foo', 'bar' ]);
		});

		it('returns the node\'s own order by terms, passing the query builder', function() {
			const result = node.getOrderByTerms(qry);

			expect(getOwnOrderByTerms).to.be.calledOnce;
			expect(getOwnOrderByTerms).to.be.calledOn(node);
			expect(getOwnOrderByTerms).to.be.calledWith(sinon.match.same(qry));
			expect(result).to.deep.equal([ 'foo', 'bar' ]);
		});

		context('node has a child', function() {
			let child: SortNode;

			beforeEach(function() {
				child = node.child = new SortNode([ {} as any ]);
				sinon.stub(child, 'getOrderByTerms').returns([ 'baz', 'qux' ]);
			});

			it('gets the order by terms of the child, passing the query builder', function() {
				node.getOrderByTerms(qry);

				expect(child.getOrderByTerms).to.be.calledOnce;
				expect(child.getOrderByTerms).to.be.calledOn(child);
				expect(child.getOrderByTerms).to.be.calledWith(
					sinon.match.same(qry),
				);
			});

			it('appends child terms to the result', function() {
				expect(node.getOrderByTerms(qry)).to.deep.equal([
					'foo',
					'bar',
					'baz',
					'qux',
				]);
			});
		});
	});

	describe('#getOwnOrderByTerms', function() {
		const rawColumn = 'raw_column';
		const order = 'order' as 'asc'|'desc';
		const nullOrder = 'nullOrder' as 'asc'|'desc';
		let descriptor: sinon.SinonStubbedInstance<ConcreteSortDescriptor>;
		let node: SortNode;
		let qry: QueryBuilder<Model>;

		beforeEach(function() {
			descriptor = sinon.createStubInstance(ConcreteSortDescriptor);
			sinon.stub(descriptor, 'order').get(() => order);
			sinon.stub(descriptor, 'nullOrder').get(() => nullOrder);
			descriptor.getRawColumn.returns(rawColumn);

			node = new SortNode([ descriptor ]);
			qry = {} as QueryBuilder<Model>;
		});

		it('returns the first ORDER BY term in an array', function() {
			const result = node.getOwnOrderByTerms(qry);

			expect(descriptor.getRawColumn).to.be.calledOnce;
			expect(descriptor.getRawColumn).to.be.calledOn(descriptor);
			expect(descriptor.getRawColumn).to.be.calledWith(
				sinon.match.same(qry),
			);
			expect(result).to.deep.equal([ 'raw_column order' ]);
		});

		it('prepends `is null` term, if descriptor is nullable', function() {
			descriptor.nullable = true;

			const result = node.getOwnOrderByTerms(qry);

			expect(descriptor.getRawColumn).to.be.calledOnce;
			expect(descriptor.getRawColumn).to.be.calledOn(descriptor);
			expect(descriptor.getRawColumn).to.be.calledWith(
				sinon.match.same(qry),
			);
			expect(result).to.deep.equal([
				'(raw_column is null) nullOrder',
				'raw_column order',
			]);
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
		let descriptor: sinon.SinonStubbedInstance<ConcreteSortDescriptor>;
		let node: SortNode;
		let qry: FakeQuery;
		let values: any[];
		let applyCursorValue: sinon.SinonStub;
		let applyNullCursorValue: sinon.SinonStub;

		beforeEach(function() {
			descriptor = sinon.createStubInstance(ConcreteSortDescriptor);
			descriptor.validateCursorValue.returnsArg(0);

			node = new SortNode([ descriptor ]);
			qry = new FakeQuery();
			values = [ 'foo', 'bar', 'baz' ];

			applyCursorValue = sinon.stub(node, 'applyCursorValue');
			applyNullCursorValue = sinon.stub(node, 'applyNullCursorValue');
		});

		it('validates the first value against the descriptor', function() {
			node.applyCursorValues(qry.builder, values);

			expect(descriptor.validateCursorValue).to.be.calledOnce;
			expect(descriptor.validateCursorValue).to.be.calledOn(descriptor);
			expect(descriptor.validateCursorValue).to.be.calledWith(
				'foo',
				ValidationCase.Cursor,
			);
		});

		it('applies the first value, with others as child values', function() {
			node.applyCursorValues(qry.builder, values);

			expect(applyCursorValue).to.be.calledOnce;
			expect(applyCursorValue).to.be.calledOn(node);
			expect(applyCursorValue).to.be.calledWith(
				sinon.match.same(qry.builder),
				'foo',
				[ 'bar', 'baz' ],
			);
			expect(applyCursorValue).to.be.calledAfter(
				descriptor.validateCursorValue,
			);
			expect(applyNullCursorValue).to.not.be.called;
		});

		it('handles a null value using a specialized method', function() {
			values[0] = null;

			node.applyCursorValues(qry.builder, values);

			expect(descriptor.validateCursorValue).to.be.calledOnce;
			expect(descriptor.validateCursorValue).to.be.calledOn(descriptor);
			expect(descriptor.validateCursorValue).to.be.calledWith(
				null,
				ValidationCase.Cursor,
			);
			expect(applyNullCursorValue).to.be.calledOnce;
			expect(applyNullCursorValue).to.be.calledOn(node);
			expect(applyNullCursorValue).to.be.calledWith(
				sinon.match.same(qry.builder),
				[ 'bar', 'baz' ],
			);
			expect(applyNullCursorValue).to.be.calledAfter(
				descriptor.validateCursorValue,
			);
			expect(applyCursorValue).to.not.be.called;
		});
	});

	describe('#applyCursorValue', function() {
		const column = 'column name';
		const value = 'some cursor value';
		let descriptor: ConcreteSortDescriptor;
		let node: SortNode;
		let qry: FakeQuery;
		let childValues: any[];
		let applyInequality: sinon.SinonStub;

		beforeEach(function() {
			descriptor = { column } as ConcreteSortDescriptor;
			node = new SortNode([ descriptor ]);
			qry = new FakeQuery();
			childValues = [];
			applyInequality = sinon.stub(node, 'applyInequality');
		});

		context('node has no child', function() {
			it('applies the value as an inequality filter to the query', function() {
				node.applyCursorValue(qry.builder, value, childValues);

				expect(applyInequality).to.be.calledOnce;
				expect(applyInequality).to.be.calledWith(
					sinon.match.same(qry.builder),
					value,
				);
			});
		});

		context('node has a child', function() {
			let child: sinon.SinonStubbedInstance<SortNode>;

			beforeEach(function() {
				child = sinon.createStubInstance(SortNode);
				node.child = child;
			});

			it('instead adds a where with a callback to the query', function() {
				node.applyCursorValue(qry.builder, value, childValues);

				expect(applyInequality).to.not.be.called;
				expect(qry.stubNames).to.deep.equal([ 'where' ]);
				expect(qry.stubs.where).to.be.calledOnce;
				expect(qry.stubs.where).to.be.calledOn(qry.builder);
				expect(qry.stubs.where).to.be.calledWith(sinon.match.func);
			});

			describe('where callback', function() {
				let callback: CallbackVoid<QueryBuilder<Model>>;
				let sub0: FakeQuery;

				beforeEach(function() {
					node.applyCursorValue(qry.builder, value, childValues);
					[ callback ] = qry.stubs.where!.firstCall.args;
					sub0 = new FakeQuery();
				});

				it('adds a where and an orWhere to the subquery, both with callbacks', function() {
					callback.call(sub0.builder, sub0.builder);

					expect(sub0.stubNames).to.deep.equal([
						'where',
						'orWhere',
					]);
					expect(sub0.stubs.where).to.be.calledOnce;
					expect(sub0.stubs.where).to.be.calledOn(sub0.builder);
					expect(sub0.stubs.where).to.be.calledWith(sinon.match.func);
					expect(sub0.stubs.orWhere).to.be.calledOnce;
					expect(sub0.stubs.orWhere).to.be.calledOn(sub0.builder);
					expect(sub0.stubs.orWhere).to.be.calledWith(
						sinon.match.func,
					);
				});

				describe('where callback', function() {
					let cb: CallbackVoid<QueryBuilder<Model>>;
					let sub1: FakeQuery;

					beforeEach(function() {
						callback.call(sub0.builder, sub0.builder);
						[ cb ] = sub0.stubs.where!.firstCall.args;
						sub1 = new FakeQuery();
					});

					it('applies the value as an inequality filter to the subquery', function() {
						cb.call(sub1.builder, sub1.builder);

						expect(applyInequality).to.be.calledOnce;
						expect(applyInequality).to.be.calledOn(node);
						expect(applyInequality).to.be.calledWith(
							sinon.match.same(sub1.builder),
							value,
						);
					});

					it('otherwise does not change the subquery', function() {
						cb.call(sub1.builder, sub1.builder);

						expect(sub1.stubNames).to.be.empty;
					});
				});

				describe('orWhere callback', function() {
					let cb: CallbackVoid<QueryBuilder<Model>>;
					let sub1: FakeQuery;

					beforeEach(function() {
						callback.call(sub0.builder, sub0.builder);
						[ cb ] = sub0.stubs.orWhere!.firstCall.args;
						sub1 = new FakeQuery();
					});

					it('adds a where equal to the value to the subquery', function() {
						cb.call(sub1.builder, sub1.builder);

						expect(sub1.stubNames).to.deep.equal([ 'where' ]);
						expect(sub1.stubs.where).to.be.calledOnce;
						expect(sub1.stubs.where).to.be.calledOn(sub1.builder);
						expect(sub1.stubs.where).to.be.calledWith({
							[column]: value,
						});
					});

					it('also applies child cursor values to the subquery', function() {
						cb.call(sub1.builder, sub1.builder);

						expect(child.applyCursorValues).to.be.calledOnce;
						expect(child.applyCursorValues).to.be.calledOn(child);
						expect(child.applyCursorValues).to.be.calledWith(
							sinon.match.same(sub1.builder),
							sinon.match.same(childValues),
						);
						expect(child.applyCursorValues).to.be.calledAfter(
							sub1.stubs.where!,
						);
					});
				});
			});
		});
	});

	describe('#applyNullCursorValue', function() {
		const column = 'column name';
		let descriptor: ConcreteSortDescriptor;
		let node: SortNode;
		let qry: FakeQuery;
		let childValues: any[];
		let applyNullCursorValueWithChildren: sinon.SinonStub;

		beforeEach(function() {
			descriptor = {
				column,
				direction: SortDirection.Ascending,
			} as ConcreteSortDescriptor;
			node = new SortNode([ descriptor ]);
			qry = new FakeQuery();
			childValues = [];
			applyNullCursorValueWithChildren = sinon.stub(
				node,
				'applyNullCursorValueWithChildren',
			);
		});

		context('node has no child', function() {
			it('adds a whereNull to the query if sort direction is ascending', function() {
				node.applyNullCursorValue(qry.builder, childValues);

				expect(qry.stubNames).to.deep.equal([ 'whereNull' ]);
				expect(qry.stubs.whereNull).to.be.calledOnce;
				expect(qry.stubs.whereNull).to.be.calledOn(qry.builder);
				expect(qry.stubs.whereNull).to.be.calledWith(column);
				expect(applyNullCursorValueWithChildren).to.not.be.called;
			});

			it('does not change the query if sort direction is descending', function() {
				descriptor.direction = SortDirection.Descending;

				node.applyNullCursorValue(qry.builder, childValues);

				expect(qry.stubNames).to.be.empty;
				expect(applyNullCursorValueWithChildren).to.not.be.called;
			});

			it('adds a whereNull to the query if sort direction is descending nulls last', function() {
				descriptor.direction = SortDirection.DescendingNullsLast;

				node.applyNullCursorValue(qry.builder, childValues);

				expect(qry.stubNames).to.deep.equal([ 'whereNull' ]);
				expect(qry.stubs.whereNull).to.be.calledOnce;
				expect(qry.stubs.whereNull).to.be.calledOn(qry.builder);
				expect(qry.stubs.whereNull).to.be.calledWith(column);
				expect(applyNullCursorValueWithChildren).to.not.be.called;
			});
		});

		context('node has a child', function() {
			beforeEach(function() {
				node.child = {} as SortNode;
			});

			it('applies the null value with children', function() {
				node.applyNullCursorValue(qry.builder, childValues);

				expect(applyNullCursorValueWithChildren).to.be.calledOnce;
				expect(applyNullCursorValueWithChildren).to.be.calledOn(node);
				expect(applyNullCursorValueWithChildren).to.be.calledWith(
					sinon.match.same(qry.builder),
					sinon.match.same(childValues),
				);
			});

			it('does not change the query otherwise', function() {
				node.applyNullCursorValue(qry.builder, childValues);

				expect(qry.stubNames).to.be.empty;
			});
		});
	});

	describe('#applyInequality', function() {
		const column = 'column name';
		const operator = 'sort operator';
		const value = 'cursor value';
		let descriptor: sinon.SinonStubbedInstance<ConcreteSortDescriptor>;
		let node: SortNode;
		let qry: FakeQuery;
		let handleNulls: sinon.SinonStub;

		beforeEach(function() {
			descriptor = { column, operator, nullable: false } as any;
			node = new SortNode([ descriptor ]);
			qry = new FakeQuery();
			handleNulls = sinon.stub(node, 'handleNulls');
		});

		it('adds an inequality filter to the query builder', function() {
			node.applyInequality(qry.builder, value);

			expect(qry.stubNames).to.deep.equal([ 'where' ]);
			expect(qry.stubs.where).to.be.calledOnce;
			expect(qry.stubs.where).to.be.calledOn(qry.builder);
			expect(qry.stubs.where).to.be.calledWith(column, operator, value);
		});

		it('handles nulls as well, if the column is nullable', function() {
			descriptor.nullable = true;

			node.applyInequality(qry.builder, value);

			expect(handleNulls).to.be.calledOnce;
			expect(handleNulls).to.be.calledOn(node);
			expect(handleNulls).to.be.calledWith(sinon.match.same(qry.builder));
			expect(handleNulls).to.be.calledAfter(qry.stubs.where!);
		});

		it('skips null handling if the column is not nullable', function() {
			node.applyInequality(qry.builder, value);

			expect(handleNulls).to.not.be.called;
		});
	});

	describe('#handleNulls', function() {
		const column = 'column name';
		let descriptor: ConcreteSortDescriptor;
		let node: SortNode;
		let qry: FakeQuery;

		beforeEach(function() {
			descriptor = { column } as ConcreteSortDescriptor;
			node = new SortNode([ descriptor ]);
			qry = new FakeQuery();
		});

		it('adds an orWhereNull to the query if sort is ascending', function() {
			descriptor.direction = SortDirection.Ascending;

			node.handleNulls(qry.builder);

			expect(qry.stubNames).to.deep.equal([ 'orWhereNull' ]);
			expect(qry.stubs.orWhereNull).to.be.calledOnce;
			expect(qry.stubs.orWhereNull).to.be.calledOn(qry.builder);
			expect(qry.stubs.orWhereNull).to.be.calledWith(column);
		});

		it('does not change query if sort is descending', function() {
			descriptor.direction = SortDirection.Descending;

			node.handleNulls(qry.builder);

			expect(qry.stubNames).to.be.empty;
		});

		it('adds an orWhereNull to the query if sort is descending nulls last', function() {
			descriptor.direction = SortDirection.DescendingNullsLast;

			node.handleNulls(qry.builder);

			expect(qry.stubNames).to.deep.equal([ 'orWhereNull' ]);
			expect(qry.stubs.orWhereNull).to.be.calledOnce;
			expect(qry.stubs.orWhereNull).to.be.calledOn(qry.builder);
			expect(qry.stubs.orWhereNull).to.be.calledWith(column);
		});
	});

	describe('#applyNullCursorValueWithChildren', function() {
		const column = 'column name';
		let descriptor: ConcreteSortDescriptor;
		let node: SortNode;
		let qry: FakeQuery;
		let childValues: any[];
		let child: sinon.SinonStubbedInstance<SortNode>;

		beforeEach(function() {
			descriptor = { column } as ConcreteSortDescriptor;
			node = new SortNode([ descriptor ]);
			qry = new FakeQuery();
			childValues = [];
			child = node.child = sinon.createStubInstance(SortNode);
		});

		context('sort direction is ascending', function() {
			beforeEach(function() {
				descriptor.direction = SortDirection.Ascending;
			});

			it('adds a whereNull to the query', function() {
				node.applyNullCursorValueWithChildren(qry.builder, childValues);

				expect(qry.stubNames).to.deep.equal([ 'whereNull' ]);
				expect(qry.stubs.whereNull).to.be.calledOnce;
				expect(qry.stubs.whereNull).to.be.calledOn(qry.builder);
				expect(qry.stubs.whereNull).to.be.calledWith(column);
			});

			it('also applies child cursor values using the child', function() {
				node.applyNullCursorValueWithChildren(qry.builder, childValues);

				expect(child.applyCursorValues).to.be.calledOnce;
				expect(child.applyCursorValues).to.be.calledOn(child);
				expect(child.applyCursorValues).to.be.calledWith(
					sinon.match.same(qry.builder),
					sinon.match.same(childValues),
				);
				expect(child.applyCursorValues).to.be.calledAfter(
					qry.stubs.whereNull!,
				);
			});
		});

		context('sort direction is descending', function() {
			beforeEach(function() {
				descriptor.direction = SortDirection.Descending;
			});

			it('adds a whereNotNull and an orWhere with a callback to the query', function() {
				node.applyNullCursorValueWithChildren(qry.builder, childValues);

				expect(qry.stubNames).to.deep.equal([
					'whereNotNull',
					'orWhere',
				]);
				expect(qry.stubs.whereNotNull).to.be.calledOnce;
				expect(qry.stubs.whereNotNull).to.be.calledOn(qry.builder);
				expect(qry.stubs.whereNotNull).to.be.calledWith(column);
				expect(qry.stubs.orWhere).to.be.calledOnce;
				expect(qry.stubs.orWhere).to.be.calledOn(qry.builder);
				expect(qry.stubs.orWhere).to.be.calledWith(sinon.match.func);
			});

			describe('orWhere callback', function() {
				let callback: CallbackVoid<QueryBuilder<Model>>;
				let sub: FakeQuery;

				beforeEach(function() {
					node.applyNullCursorValueWithChildren(
						qry.builder,
						childValues,
					);
					[ callback ] = qry.stubs.orWhere!.firstCall.args;
					sub = new FakeQuery();
				});

				it('adds a whereNull to the subquery', function() {
					callback.call(sub.builder, sub.builder);

					expect(sub.stubNames).to.deep.equal([ 'whereNull' ]);
					expect(sub.stubs.whereNull).to.be.calledOnce;
					expect(sub.stubs.whereNull).to.be.calledOn(sub.builder);
					expect(sub.stubs.whereNull).to.be.calledWith(column);
				});

				it('also applies child cursor values using the child', function() {
					callback.call(sub.builder, sub.builder);

					expect(child.applyCursorValues).to.be.calledOnce;
					expect(child.applyCursorValues).to.be.calledOn(child);
					expect(child.applyCursorValues).to.be.calledWith(
						sinon.match.same(sub.builder),
						sinon.match.same(childValues),
					);
					expect(child.applyCursorValues).to.be.calledAfter(
						sub.stubs.whereNull!,
					);
				});
			});
		});

		context('sort direction is descending nulls last', function() {
			beforeEach(function() {
				descriptor.direction = SortDirection.DescendingNullsLast;
			});

			it('adds a whereNull to the query', function() {
				node.applyNullCursorValueWithChildren(qry.builder, childValues);

				expect(qry.stubNames).to.deep.equal([ 'whereNull' ]);
				expect(qry.stubs.whereNull).to.be.calledOnce;
				expect(qry.stubs.whereNull).to.be.calledOn(qry.builder);
				expect(qry.stubs.whereNull).to.be.calledWith(column);
			});

			it('also applies child cursor values using the child', function() {
				node.applyNullCursorValueWithChildren(qry.builder, childValues);

				expect(child.applyCursorValues).to.be.calledOnce;
				expect(child.applyCursorValues).to.be.calledOn(child);
				expect(child.applyCursorValues).to.be.calledWith(
					sinon.match.same(qry.builder),
					sinon.match.same(childValues),
				);
				expect(child.applyCursorValues).to.be.calledAfter(
					qry.stubs.whereNull!,
				);
			});
		});
	});
});
