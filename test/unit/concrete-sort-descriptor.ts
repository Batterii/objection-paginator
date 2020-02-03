import { ColumnType, SortDirection } from '../../lib/sort-descriptor';
import { ConcreteSortDescriptor } from '../../lib/concrete-sort-descriptor';
import { ConfigurationError } from '../../lib/configuration-error';
import { InvalidCursorError } from '../../lib/invalid-cursor-error';
import _ from 'lodash';
import { expect } from 'chai';
import sinon from 'sinon';

describe('ConcreteSortDescriptor', function() {
	it('stores info from the provided descriptor', function() {
		const column = 'some column name';
		const columnType = 'some column type' as ColumnType;
		const direction = 'sort direction' as SortDirection;
		const valuePath = 'value path';

		const descriptor = new ConcreteSortDescriptor({
			column,
			columnType,
			direction,
			valuePath,
		});

		expect(descriptor.column).to.equal(column);
		expect(descriptor.columnType).to.equal(columnType);
		expect(descriptor.direction).to.equal(direction);
		expect(descriptor.valuePath).to.equal(valuePath);
	});

	it('uses column name as the default value path', function() {
		const column = 'some column name';
		const columnType = 'some column type' as ColumnType;
		const direction = 'sort direction' as SortDirection;

		const descriptor = new ConcreteSortDescriptor({
			column,
			columnType,
			direction,
		});

		expect(descriptor.column).to.equal(column);
		expect(descriptor.columnType).to.equal(columnType);
		expect(descriptor.direction).to.equal(direction);
		expect(descriptor.valuePath).to.equal(column);
	});

	describe('#getOperator', function() {
		let descriptor: ConcreteSortDescriptor;

		beforeEach(function() {
			descriptor = new ConcreteSortDescriptor({} as any);
		});

		it('returns \'>\' for ascending direction', function() {
			descriptor.direction = SortDirection.Ascending;

			expect(descriptor.getOperator()).to.equal('>');
		});

		it('returns \'<\' for descending direction', function() {
			descriptor.direction = SortDirection.Descending;

			expect(descriptor.getOperator()).to.equal('<');
		});

		it('throws for any other direction', function() {
			descriptor.direction = 'other direction lol' as SortDirection;

			expect(() => {
				descriptor.getOperator();
			}).to.throw(ConfigurationError).that.includes({
				shortMessage: 'Unknown sort direction \'other direction lol\'',
				cause: null,
				info: null,
			});
		});
	});

	describe('#checkCursorValue', function() {
		const value = 'provided value';
		const isStringResult = 'isString result';
		const isFiniteResult = 'isFinite result';
		const isIntegerResult = 'isInteger result';
		const isBooleanResult = 'isBoolean result';
		let descriptor: ConcreteSortDescriptor;

		beforeEach(function() {
			descriptor = new ConcreteSortDescriptor({} as any);

			sinon.stub(_, 'isString').callThrough()
				.withArgs(value).returns(isStringResult as any);
			sinon.stub(_, 'isFinite').callThrough()
				.withArgs(value).returns(isFiniteResult as any);
			sinon.stub(_, 'isInteger').callThrough()
				.withArgs(value).returns(isIntegerResult as any);
			sinon.stub(_, 'isBoolean').callThrough()
				.withArgs(value).returns(isBooleanResult as any);
		});

		it('checks the value with isString, if columnType is string', function() {
			descriptor.columnType = ColumnType.String;

			expect(descriptor.checkCursorValue(value)).to.equal(isStringResult);
		});

		it('checks the value with isFinite, if columnType is number', function() {
			descriptor.columnType = ColumnType.Number;

			expect(descriptor.checkCursorValue(value)).to.equal(isFiniteResult);
		});

		it('checks the value with isString, if columnType is int', function() {
			descriptor.columnType = ColumnType.Int;

			expect(descriptor.checkCursorValue(value))
				.to.equal(isIntegerResult);
		});

		it('checks the value with isString, if columnType is boolean', function() {
			descriptor.columnType = ColumnType.Boolean;

			expect(descriptor.checkCursorValue(value))
				.to.equal(isBooleanResult);
		});

		it('throws for any other columnType', function() {
			descriptor.columnType = 'other column type' as ColumnType;

			expect(() => {
				descriptor.checkCursorValue(value);
			}).to.throw(ConfigurationError).that.includes({
				shortMessage: 'Unknown column type \'other column type\'',
				cause: null,
				info: null,
			});
		});
	});

	describe('#getNextCursorValue', function() {
		let descriptor: ConcreteSortDescriptor;
		let values: any[];
		let checkCursorValue: sinon.SinonStub;

		beforeEach(function() {
			descriptor = new ConcreteSortDescriptor({} as any);
			descriptor.columnType = 'some column type' as ColumnType;
			values = [ 'foo', 'bar' ];
			checkCursorValue = sinon.stub(descriptor, 'checkCursorValue')
				.returns(true);
		});

		it('checks the first elemet of the provided values', function() {
			descriptor.getNextCursorValue(values);

			expect(checkCursorValue).to.be.calledOnce;
			expect(checkCursorValue).to.be.calledOn(descriptor);
			expect(checkCursorValue).to.be.calledWith('foo');
		});

		it('returns the first element if it passes the check', function() {
			expect(descriptor.getNextCursorValue(values)).to.equal('foo');
		});

		it('throws if the first element does not pass the check', function() {
			checkCursorValue.returns(false);

			expect(() => {
				descriptor.getNextCursorValue(values);
			}).to.throw(InvalidCursorError)
				.that.satisfies((err: InvalidCursorError) => {
					expect(err.shortMessage).to.equal(
						'Cursor value does not match its column type',
					);
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({
						value: 'foo',
						columnType: descriptor.columnType,
					});
					return true;
				});
		});
	});
});
