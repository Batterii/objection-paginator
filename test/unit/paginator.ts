import { GetPageOptions, Page, Paginator } from '../../lib/paginator';
import { Model, QueryBuilder } from 'objection';
import { Cursor } from '../../lib/cursor';
import { FakeQuery } from '@batterii/fake-query';
import { InvalidCursorError } from '../../lib/invalid-cursor-error';
import { SortNode } from '../../lib/sort-node';
import { UnknownSortError } from '../../lib/unknown-sort-error';
import _ from 'lodash';
import { createSortNode } from '../../lib/create-sort-node';
import { expect } from 'chai';
import objectHash from 'object-hash';
import sinon from 'sinon';

class TestModel extends Model {}

class TestPaginator extends Paginator<TestModel> {
	static sorts = {};

	getBaseQuery(): QueryBuilder<TestModel> {
		return {} as QueryBuilder<TestModel>;
	}
}

interface OtherPaginatorArgs {
	foo: string;
}

class OtherPaginator extends Paginator<TestModel, OtherPaginatorArgs> {
	static queryName = 'Other';

	getBaseQuery(): QueryBuilder<TestModel> {
		return {} as QueryBuilder<TestModel>;
	}
}

describe('Paginator', function() {
	it('stores provided limit', function() {
		const paginator = new TestPaginator({ limit: 42, sort: 'some sort' });

		expect(paginator.limit).to.equal(42);
	});

	it('stores provided sort', function() {
		const paginator = new TestPaginator({ limit: 42, sort: 'some sort' });

		expect(paginator.sort).to.equal('some sort');
	});

	it('defaults to 1000 limit', function() {
		const paginator = new TestPaginator({ sort: 'some sort' });

		expect(paginator.limit).to.equal(1000);
	});

	it('defaults to \'default\' sort', function() {
		const paginator = new TestPaginator({ limit: 42 });

		expect(paginator.sort).to.equal('default');
	});

	it('has undefined args normally', function() {
		const paginator = new TestPaginator({ limit: 42, sort: 'some sort' });

		expect(paginator.args).to.be.undefined;
	});


	it('allows specifying required args in type param', function() {
		const args = { foo: 'bar' };
		const paginator = new OtherPaginator({}, args);

		expect(paginator.args).to.equal(args);
	});

	it('prevents changing of limit after creation', function() {
		const paginator = new TestPaginator();

		expect(() => {
			(paginator as any).limit = 42;
		}).to.throw(TypeError);
	});

	it('prevents changing of sort after creation', function() {
		const paginator = new TestPaginator();

		expect(() => {
			(paginator as any).sort = 'some other sort';
		}).to.throw(TypeError);
	});

	it('prevents assiging over args after creation', function() {
		const paginator = new OtherPaginator({}, { foo: 'baz' });

		expect(() => {
			(paginator as any).args = {};
		}).to.throw(TypeError);
	});

	it('defines limit, sort, and args as enumerable', function() {
		const paginator = new TestPaginator();

		expect(paginator).to.have.keys([ 'limit', 'sort', 'args' ]);
	});

	describe('::getPage', function() {
		const limit = 42;
		const sort = 'some sort name';
		const cursor = 'some cursor string';
		let options: GetPageOptions;
		let page: Page<TestModel>;
		let execute: sinon.SinonStub;

		beforeEach(function() {
			options = { limit, sort, cursor };
			page = {} as Page<TestModel>;
			execute = sinon.stub(Paginator.prototype, 'execute').resolves(page);
		});

		it('executes an instance with the provided cursor', async function() {
			const result = await TestPaginator.getPage(options);

			expect(execute).to.be.calledOnce;
			expect(execute).to.be.calledOn(
				sinon.match.instanceOf(TestPaginator),
			);
			expect(execute).to.be.calledWith(cursor);
			expect(result).to.equal(page);
		});

		it('creates the instance with the provided limit and sort', async function() {
			await TestPaginator.getPage(options);
			const paginator = execute.firstCall.thisValue;

			expect(paginator.limit).to.equal(limit);
			expect(paginator.sort).to.equal(sort);
		});

		it('supports omitted options', async function() {
			const result = await TestPaginator.getPage();

			expect(execute).to.be.calledOnce;
			expect(execute).to.be.calledOn(
				sinon.match.instanceOf(TestPaginator),
			);
			expect(execute).to.be.calledWith(undefined);
			expect(result).to.equal(page);
		});

		context('required args specified in type params', function() {
			let args: OtherPaginatorArgs;

			beforeEach(function() {
				args = {} as OtherPaginatorArgs;
			});

			it('accepts the required args', async function() {
				const result = await OtherPaginator.getPage(options, args);

				expect(execute).to.be.calledOnce;
				expect(execute).to.be.calledOn(
					sinon.match.instanceOf(OtherPaginator),
				);
				expect(execute).to.be.calledWith(cursor);
				expect(result).to.equal(page);
			});

			it('passes the args to the instance', async function() {
				await OtherPaginator.getPage(options, args);
				const paginator = execute.firstCall.thisValue;

				expect(paginator.limit).to.equal(limit);
				expect(paginator.sort).to.equal(sort);
				expect(paginator.args).to.equal(args);
			});
		});
	});

	describe('::_getQueryName', function() {
		it('returns the constructor name', function() {
			expect((TestPaginator as any)._getQueryName())
				.to.equal('TestPaginator');
		});

		it('can be overriden with queryName property', function() {
			expect((OtherPaginator as any)._getQueryName()).to.equal('Other');
		});
	});

	describe('::_createSortNodes', function() {
		let sortNodes: Record<string, SortNode>;
		let mapValues: sinon.SinonStub;

		beforeEach(function() {
			sortNodes = {};
			mapValues = sinon.stub(_, 'mapValues').returns(sortNodes);
		});

		it('creates sort nodes from sorts property values', function() {
			(TestPaginator as any)._createSortNodes();

			expect(mapValues).to.be.calledOnce;
			expect(mapValues).to.be.calledWith(
				sinon.match.same(TestPaginator.sorts),
				createSortNode,
			);
		});

		it('returns the created sort nodes', function() {
			expect((TestPaginator as any)._createSortNodes())
				.to.equal(sortNodes);
		});

		it('simply returns an empty object if there is no sorts property', function() {
			const result = (OtherPaginator as any)._createSortNodes();

			expect(mapValues).to.not.be.called;
			expect(result).to.deep.equal({});
		});
	});

	describe('::_getSortNodes', function() {
		let sortNodes: Record<string, SortNode>;
		let createSortNodes: sinon.SinonStub;

		beforeEach(function() {
			sortNodes = {};
			createSortNodes = sinon.stub(
				TestPaginator as any,
				'_createSortNodes',
			).returns(sortNodes);
		});

		afterEach(function() {
			delete (TestPaginator as any)._sortNodes;
		});

		it('creates sort nodes, if they do not exist', function() {
			(TestPaginator as any)._getSortNodes();

			expect(createSortNodes).to.be.calledOnce;
			expect(createSortNodes).to.be.calledOn(TestPaginator);
		});

		it('stores the created sort nodes', function() {
			(TestPaginator as any)._getSortNodes();

			expect((TestPaginator as any)._sortNodes).to.equal(sortNodes);
		});

		it('returns the created sort nodes', function() {
			expect((TestPaginator as any)._getSortNodes()).to.equal(sortNodes);
		});

		it('returns stored sort nodes, if they already exist', function() {
			(TestPaginator as any)._sortNodes = sortNodes;

			const result = (TestPaginator as any)._getSortNodes();

			expect(createSortNodes).to.not.be.called;
			expect(result).to.equal(sortNodes);
		});
	});

	describe('#execute', function() {
		const cursor = 'original cursor string';
		const newCursor = 'new cursor string';
		const blankCursor = 'blank cursor string';
		const remainingCount = 101;
		let paginator: TestPaginator;
		let items: TestModel[];
		let qry: FakeQuery;
		let getQuery: sinon.SinonStub;
		let getRemainingCount: sinon.SinonStub;
		let createCursorString: sinon.SinonStub;

		beforeEach(function() {
			paginator = new TestPaginator();

			items = _.times(3, () => ({} as TestModel));
			qry = new FakeQuery().resolves(items);
			getQuery = sinon.stub(paginator as any, '_getQuery')
				.returns(qry.builder);

			getRemainingCount = sinon.stub(
				paginator as any,
				'_getRemainingCount',
			).returns(remainingCount);

			createCursorString = sinon.stub(
				paginator as any,
				'_createCursorString',
			);
			createCursorString
				.withArgs(sinon.match.same(items[2])).returns(newCursor)
				.withArgs().returns(blankCursor);
		});

		it('gets the query builder to execute', async function() {
			await paginator.execute(cursor);

			expect(getQuery).to.be.calledOnce;
			expect(getQuery).to.be.calledOn(paginator);
			expect(getQuery).to.be.calledWith(cursor);
		});

		it('executes the query builder with no further modification', async function() {
			await paginator.execute(cursor);

			expect(qry.stubNames).to.deep.equal([]);
		});

		it('gets the remaining count, using the builder and item count', async function() {
			await paginator.execute(cursor);

			expect(getRemainingCount).to.be.calledOnce;
			expect(getRemainingCount).to.be.calledOn(paginator);
			expect(getRemainingCount).to.be.calledWith(
				sinon.match.same(qry.builder),
				3,
			);
		});

		it('creates a cursor string from the last item', async function() {
			await paginator.execute(cursor);

			expect(createCursorString).to.be.calledOnce;
			expect(createCursorString).to.be.calledOn(paginator);
			expect(createCursorString).to.be.calledWith(
				sinon.match.same(items[2]),
			);
		});

		it('resolves with items, remaining count, and new cursor', async function() {
			const result = await paginator.execute(cursor);

			expect(result).to.be.an.instanceOf(Object);
			expect(result).to.have.keys([ 'items', 'remaining', 'cursor' ]);
			expect(result.items).to.equal(items);
			expect(result.remaining).to.equal(remainingCount);
			expect(result.cursor).to.equal(newCursor);
		});

		context('no items were found', function() {
			beforeEach(function() {
				qry.resolves([]);
			});

			it('skips remaining count and resolves with the original cursor', async function() {
				const result = await paginator.execute(cursor);

				expect(getRemainingCount).to.not.be.called;
				expect(createCursorString).to.not.be.called;
				expect(result).to.be.an.instanceOf(Object);
				expect(result).to.have.keys([ 'items', 'remaining', 'cursor' ]);
				expect(result.items).to.deep.equal([]);
				expect(result.remaining).to.equal(0);
				expect(result.cursor).to.equal(cursor);
			});

			it('creates and resolves with a blank cursor, if none was provided', async function() {
				qry.resolves([]);

				const result = await paginator.execute();

				expect(getRemainingCount).to.not.be.called;
				expect(createCursorString).to.be.calledOnce;
				expect(createCursorString).to.be.calledOn(paginator);
				expect(createCursorString).to.be.calledWithExactly();
				expect(result).to.be.an.instanceOf(Object);
				expect(result).to.have.keys([ 'items', 'remaining', 'cursor' ]);
				expect(result.items).to.deep.equal([]);
				expect(result.remaining).to.equal(0);
				expect(result.cursor).to.equal(blankCursor);
			});
		});
	});

	describe('#_getSortNode', function() {
		let paginator: TestPaginator;
		let sortNode: SortNode;
		let sortNodes: Record<string, SortNode>;
		let getSortNodes: sinon.SinonStub;

		beforeEach(function() {
			paginator = new TestPaginator({ sort: 'foo' });

			sortNode = {} as SortNode;
			sortNodes = { foo: sortNode, bar: {} as SortNode };
			getSortNodes = sinon.stub(TestPaginator as any, '_getSortNodes')
				.returns(sortNodes);
		});

		it('gets the sort nodes for the class', function() {
			(paginator as any)._getSortNode();

			expect(getSortNodes).to.be.calledOnce;
			expect(getSortNodes).to.be.calledOn(TestPaginator);
		});

		it('returns the node corresponding to the sort', function() {
			expect((paginator as any)._getSortNode()).to.equal(sortNode);
		});

		it('throws if a corresponding node is not found', function() {
			delete sortNodes.foo;

			expect(() => {
				(paginator as any)._getSortNode();
			}).to.throw(UnknownSortError)
				.that.satisfies((err: UnknownSortError) => {
					expect(err.usedDefaultMessage).to.be.true;
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({ sort: 'foo' });
					return true;
				});
		});
	});

	describe('#_createCursor', function() {
		const queryName = 'some query name';
		const sort = 'some sort name';
		const argsHash = 'args hash';
		let args: OtherPaginatorArgs;
		let paginator: Paginator<TestModel, any>;
		let item: TestModel;
		let getQueryName: sinon.SinonStub;
		let cursorValues: any[];
		let sortNode: sinon.SinonStubbedInstance<SortNode>;
		let getSortNode: sinon.SinonStub;
		let md5: sinon.SinonStub;

		beforeEach(function() {
			args = { foo: 'baz' };
			paginator = new OtherPaginator({ sort }, args);
			item = {} as TestModel;

			getQueryName = sinon.stub(OtherPaginator as any, '_getQueryName')
				.returns(queryName);

			cursorValues = [];
			sortNode = sinon.createStubInstance(SortNode);
			getSortNode = sinon.stub(paginator as any, '_getSortNode')
				.returns(sortNode);
			sortNode.getCursorValues.returns(cursorValues);

			md5 = sinon.stub(objectHash, 'MD5').returns(argsHash);
		});

		it('gets the query name from the class', function() {
			(paginator as any)._createCursor(item);

			expect(getQueryName).to.be.calledOnce;
			expect(getQueryName).to.be.calledOn(OtherPaginator);
		});

		it('gets the sort node', function() {
			(paginator as any)._createCursor(item);

			expect(getSortNode).to.be.calledOnce;
			expect(getSortNode).to.be.calledOn(paginator);
		});

		it('gets cursor values from the item using the sort node', function() {
			(paginator as any)._createCursor(item);

			expect(sortNode.getCursorValues).to.be.calledOnce;
			expect(sortNode.getCursorValues).to.be.calledOn(sortNode);
			expect(sortNode.getCursorValues).to.be.calledWith(
				sinon.match.same(item),
			);
		});

		it('hashes the args object with MD5', function() {
			(paginator as any)._createCursor(item);

			expect(md5).to.be.calledOnce;
			expect(md5).to.be.calledWith(sinon.match.same(args));
		});

		it('returns a new cursor with the query name, sort name, values, and args hash', function() {
			const result = (paginator as any)._createCursor(item);

			expect(result).to.be.an.instanceOf(Cursor);
			expect(result.query).to.equal(queryName);
			expect(result.sort).to.equal(sort);
			expect(result.values).to.equal(cursorValues);
			expect(result.argsHash).to.equal(argsHash);
		});

		it('skips sortNode and value fetching if item is not provided', function() {
			const result = (paginator as any)._createCursor();

			expect(getSortNode).to.not.be.called;
			expect(result).to.be.an.instanceOf(Cursor);
			expect(result.query).to.equal(queryName);
			expect(result.sort).to.equal(sort);
			expect(result.values).to.be.undefined;
			expect(result.argsHash).to.equal(argsHash);
		});

		it('skips args hash if there are paginator args', function() {
			paginator = new TestPaginator({ sort });
			getQueryName = sinon.stub(TestPaginator as any, '_getQueryName')
				.returns(queryName);
			getSortNode = sinon.stub(paginator as any, '_getSortNode')
				.returns(sortNode);

			const result = (paginator as any)._createCursor(item);

			expect(md5).to.not.be.called;
			expect(result).to.be.an.instanceOf(Cursor);
			expect(result.query).to.equal(queryName);
			expect(result.sort).to.equal(sort);
			expect(result.values).to.equal(cursorValues);
			expect(result.argsHash).to.be.undefined;
		});
	});

	describe('#_createCursorString', function() {
		const cursorString = 'serialized cursor';
		let paginator: TestPaginator;
		let item: TestModel;
		let cursor: sinon.SinonStubbedInstance<Cursor>;
		let createCursor: sinon.SinonStub;
		let result: string;

		beforeEach(function() {
			paginator = new TestPaginator();
			item = {} as TestModel;
			cursor = sinon.createStubInstance(Cursor);
			createCursor = sinon.stub(paginator as any, '_createCursor')
				.returns(cursor);
			cursor.serialize.returns(cursorString);

			result = (paginator as any)._createCursorString(item);
		});

		it('creates a cursor from the provided item', function() {
			expect(createCursor).to.be.calledOnce;
			expect(createCursor).to.be.calledOn(paginator);
			expect(createCursor).to.be.calledWith(sinon.match.same(item));
		});

		it('serializes the created cursor', function() {
			expect(cursor.serialize).to.be.calledOnce;
			expect(cursor.serialize).to.be.calledOn(cursor);
		});

		it('returns the serialized cursor', function() {
			expect(result).to.equal(cursorString);
		});
	});

	describe('#_validateCursor', function() {
		const argsHash = 'cursor args hash';
		let args: OtherPaginatorArgs;
		let paginator: Paginator<TestModel, any>;
		let cursor: Cursor;
		let getQueryName: sinon.SinonStub;
		let md5: sinon.SinonStub;

		beforeEach(function() {
			args = { foo: 'bar' };
			paginator = new OtherPaginator({ sort: 'foo' }, args);
			cursor = new Cursor(
				'cursor query name',
				'foo',
				undefined,
				argsHash,
			);

			getQueryName = sinon.stub(OtherPaginator as any, '_getQueryName')
				.returns(cursor.query);

			md5 = sinon.stub(objectHash, 'MD5').returns(argsHash);
		});

		it('gets the query name from the class', function() {
			(paginator as any)._validateCursor(cursor);

			expect(getQueryName).to.be.calledOnce;
			expect(getQueryName).to.be.calledOn(OtherPaginator);
		});

		it('hashes the instance\'s args with MD5', function() {
			(paginator as any)._validateCursor(cursor);

			expect(md5).to.be.calledOnce;
			expect(md5).to.be.calledWith(sinon.match.same(args));
		});

		it('returns the provided cursor', function() {
			expect((paginator as any)._validateCursor(cursor)).to.equal(cursor);
		});

		it('throws if the query name does not match the cursor', function() {
			const queryName = 'some other query name';
			getQueryName.returns(queryName);

			expect(() => {
				(paginator as any)._validateCursor(cursor);
			}).to.throw(InvalidCursorError)
				.that.satisfies((err: InvalidCursorError) => {
					expect(err.shortMessage).to.equal(
						'Cursor is for a different query',
					);
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({
						cursorQuery: cursor.query,
						expectedQuery: queryName,
					});
					return true;
				});
		});

		it('throws if the sort name does not match the cursor', function() {
			cursor.sort = 'some other sort';

			expect(() => {
				(paginator as any)._validateCursor(cursor);
			}).to.throw(InvalidCursorError)
				.that.satisfies((err: InvalidCursorError) => {
					expect(err.shortMessage).to.equal(
						'Cursor is for a different sort',
					);
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({
						cursorSort: cursor.sort,
						expectedSort: paginator.sort,
					});
					return true;
				});
		});

		it('throws if the args hash does not match the cursor', function() {
			cursor.argsHash = 'some other args hash';

			expect(() => {
				(paginator as any)._validateCursor(cursor);
			}).to.throw(InvalidCursorError)
				.that.satisfies((err: InvalidCursorError) => {
					expect(err.shortMessage).to.equal('Args hash mismatch');
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({ expectedArgs: args });
					return true;
				});
		});

		it('skips the args hash check if the paginator has no args', function() {
			paginator = new TestPaginator({ sort: 'foo' });
			getQueryName = sinon.stub(TestPaginator as any, '_getQueryName')
				.returns(cursor.query);

			const result = (paginator as any)._validateCursor(cursor);

			expect(md5).to.not.be.called;
			expect(result).to.equal(cursor);
		});
	});

	describe('#_parseCursor', function() {
		const str = 'encoded cursor string';
		let paginator: TestPaginator;
		let cursor: Cursor;
		let parse: sinon.SinonStub;
		let validateCursor: sinon.SinonStub;

		beforeEach(function() {
			paginator = new TestPaginator();
			cursor = {} as Cursor;
			parse = sinon.stub(Cursor, 'parse').returns(cursor);
			validateCursor = sinon.stub(paginator as any, '_validateCursor')
				.returnsArg(0);
		});

		it('parses the provided string as a Cursor', function() {
			(paginator as any)._parseCursor(str);

			expect(parse).to.be.calledOnce;
			expect(parse).to.be.calledOn(Cursor);
			expect(parse).to.be.calledWith(str);
		});

		it('validates the parsed cursor against this query', function() {
			(paginator as any)._parseCursor(str);

			expect(validateCursor).to.be.calledOnce;
			expect(validateCursor).to.be.calledOn(paginator);
			expect(validateCursor).to.be.calledWith(sinon.match.same(cursor));
		});

		it('returns the parsed cursor', function() {
			expect((paginator as any)._parseCursor(str)).to.equal(cursor);
		});
	});

	describe('#_getCursorValues', function() {
		const str = 'encoded cursor string';
		let paginator: TestPaginator;
		let cursorValues: any[];
		let cursor: Cursor;
		let parseCursor: sinon.SinonStub;

		beforeEach(function() {
			paginator = new TestPaginator();
			cursorValues = [];
			cursor = { values: cursorValues } as Cursor;
			parseCursor = sinon.stub(paginator as any, '_parseCursor')
				.returns(cursor);
		});

		it('parses the provided string as a cursor using this query', function() {
			(paginator as any)._getCursorValues(str);

			expect(parseCursor).to.be.calledOnce;
			expect(parseCursor).to.be.calledOn(paginator);
			expect(parseCursor).to.be.calledWith(str);
		});

		it('returns the values from the parsed cursor', function() {
			const result = (paginator as any)._getCursorValues(str);

			expect(result).to.equal(cursorValues);
		});

		it('returns undefined without parsing if no string is provided', function() {
			const result = (paginator as any)._getCursorValues();

			expect(parseCursor).to.not.be.called;
			expect(result).to.be.undefined;
		});
	});

	describe('#_applySortNode', function() {
		const cursor = 'encoded cursor string';
		let paginator: TestPaginator;
		let qry: QueryBuilder<TestModel>;
		let cursorValues: any[];
		let getCursorValues: sinon.SinonStub;
		let sortNode: sinon.SinonStubbedInstance<SortNode>;
		let getSortNode: sinon.SinonStub;

		beforeEach(function() {
			paginator = new TestPaginator();
			qry = {} as QueryBuilder<TestModel>;

			cursorValues = [];
			getCursorValues = sinon.stub(paginator as any, '_getCursorValues')
				.returns(cursorValues);

			sortNode = sinon.createStubInstance(SortNode);
			getSortNode = sinon.stub(paginator as any, '_getSortNode')
				.returns(sortNode);
			sortNode.apply.returnsArg(0);
		});

		it('gets the values from the provided cursor string', function() {
			(paginator as any)._applySortNode(qry, cursor);

			expect(getCursorValues).to.be.calledOnce;
			expect(getCursorValues).to.be.calledOn(paginator);
			expect(getCursorValues).to.be.calledWith(cursor);
		});

		it('gets the sort node', function() {
			(paginator as any)._applySortNode(qry, cursor);

			expect(getSortNode).to.be.calledOnce;
			expect(getSortNode).to.be.calledOn(paginator);
		});

		it('applies the sort node to the provided query, with cursor values', function() {
			(paginator as any)._applySortNode(qry, cursor);

			expect(sortNode.apply).to.be.calledOnce;
			expect(sortNode.apply).to.be.calledOn(sortNode);
			expect(sortNode.apply).to.be.calledWith(
				sinon.match.same(qry),
				sinon.match.same(cursorValues),
			);
		});
	});

	describe('#_applyLimit', function() {
		it('applies the limit to the provided query', function() {
			const paginator = new TestPaginator({ limit: 42 });
			const qry = new FakeQuery();

			(paginator as any)._applyLimit(qry.builder);

			expect(qry.stubNames).to.deep.equal([ 'limit' ]);
			expect(qry.stubs.limit).to.be.calledWith(42);
		});
	});

	describe('#_getQuery', function() {
		const cursor = 'encoded cursor string';
		let paginator: TestPaginator;
		let qry: QueryBuilder<TestModel>;
		let getBaseQuery: sinon.SinonStub;
		let applySortNode: sinon.SinonStub;
		let applyLimit: sinon.SinonStub;
		let result: QueryBuilder<TestModel>;

		beforeEach(function() {
			paginator = new TestPaginator();

			qry = {} as QueryBuilder<TestModel>;
			getBaseQuery = sinon.stub(paginator, 'getBaseQuery')
				.returns(qry);

			applySortNode = sinon.stub(paginator as any, '_applySortNode');
			applyLimit = sinon.stub(paginator as any, '_applyLimit');

			result = (paginator as any)._getQuery(cursor);
		});

		it('gets the base query', function() {
			expect(getBaseQuery).to.be.calledOnce;
			expect(getBaseQuery).to.be.calledOn(paginator);
		});

		it('applies the sort node to the query', function() {
			expect(applySortNode).to.be.calledOnce;
			expect(applySortNode).to.be.calledOn(paginator);
			expect(applySortNode).to.be.calledWith(
				sinon.match.same(qry),
				cursor,
			);
		});

		it('applies the limit to the query', function() {
			expect(applyLimit).to.be.calledOnce;
			expect(applyLimit).to.be.calledOn(paginator);
			expect(applyLimit).to.be.calledWith(qry);
		});

		it('returns the query query', function() {
			expect(result).to.equal(qry);
		});
	});

	describe('_getRemainingCount', function() {
		let paginator: TestPaginator;
		let qry: FakeQuery;

		beforeEach(function() {
			paginator = new TestPaginator({ limit: 42 });
			qry = new FakeQuery();
			qry.resolves(1337);
			sinon.spy(qry.builder, 'then');
		});

		it('fetches the full query result size', async function() {
			await (paginator as any)._getRemainingCount(qry.builder, 101);

			expect(qry.stubNames).to.deep.equal([ 'resultSize' ]);
			expect(qry.stubs.resultSize).to.be.calledOnce;
			expect(qry.stubs.resultSize).to.be.calledOn(qry.builder);
		});

		it('returns the difference between result size and item count', async function() {
			const result = await (paginator as any)._getRemainingCount(
				qry.builder,
				101,
			);

			expect(result).to.equal(1236);
		});

		it('simply returns zero if item count is less than the limit', async function() {
			const result = await (paginator as any)._getRemainingCount(
				qry.builder,
				41,
			);

			expect(qry.stubNames).to.deep.equal([]);
			expect(qry.builder.then).to.not.be.called;
			expect(result).to.equal(0);
		});

		it('proceeds normally if item count equals the limit', async function() {
			const result = await (paginator as any)._getRemainingCount(
				qry.builder,
				42,
			);

			expect(qry.stubNames).to.deep.equal([ 'resultSize' ]);
			expect(qry.stubs.resultSize).to.be.calledOnce;
			expect(qry.stubs.resultSize).to.be.calledOn(qry.builder);
			expect(result).to.equal(1295);
		});
	});
});
