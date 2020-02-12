import { ColumnType, SortDirection } from '../../lib/sort-descriptor';
import { ConcreteSortDescriptor } from '../../lib/concrete-sort-descriptor';
import { ConfigurationError } from '../../lib/configuration-error';
import { InvalidCursorError } from '../../lib/invalid-cursor-error';
import _ from 'lodash';
import { expect } from 'chai';
import sinon from 'sinon';

describe('ConcreteSortDescriptor', function() {
	const column = 'some column name';
	const columnType = 'some column type' as ColumnType;
	const direction = 'sort direction' as SortDirection;
	const valuePath = 'value path';
	const validate = () => true;
	let descriptor: ConcreteSortDescriptor;

	beforeEach(function() {
		descriptor = new ConcreteSortDescriptor({
			column,
			columnType,
			direction,
			valuePath,
			validate,
		});
	});

	it('stores info from the provided descriptor', function() {
		expect(descriptor.column).to.equal(column);
		expect(descriptor.columnType).to.equal(columnType);
		expect(descriptor.direction).to.equal(direction);
		expect(descriptor.valuePath).to.equal(valuePath);
		expect(descriptor.validate).to.equal(validate);
	});

	it('uses string as the default column type', function() {
		descriptor = new ConcreteSortDescriptor({
			column,
			direction,
			valuePath,
			validate,
		});

		expect(descriptor.columnType).to.equal(ColumnType.String);
	});

	it('uses ascending as the default sort direction', function() {
		descriptor = new ConcreteSortDescriptor({
			column,
			columnType,
			valuePath,
			validate,
		});

		expect(descriptor.direction).to.equal(SortDirection.Ascending);
	});

	it('uses column name as the default value path', function() {
		descriptor = new ConcreteSortDescriptor({
			column,
			columnType,
			direction,
			validate,
		});

		expect(descriptor.valuePath).to.equal(column);
	});

	it('does not use a default validation function', function() {
		descriptor = new ConcreteSortDescriptor({
			column,
			columnType,
			direction,
			valuePath,
		});

		expect(descriptor.validate).to.be.undefined;
	});

	it('supports specifing descriptor as a string for column name only', function() {
		descriptor = new ConcreteSortDescriptor(column);

		expect(descriptor.column).to.equal(column);
		expect(descriptor.columnType).to.equal(ColumnType.String);
		expect(descriptor.direction).to.equal(SortDirection.Ascending);
		expect(descriptor.valuePath).to.equal(column);
		expect(descriptor.validate).to.be.undefined;
	});

	describe('#getOperator', function() {
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

		beforeEach(function() {
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

	describe('#validateCursorValue', function() {
		const value = 'provided value';
		let checkCursorValue: sinon.SinonStub;
		let validateStub: sinon.SinonStub;

		beforeEach(function() {
			checkCursorValue = sinon.stub(descriptor, 'checkCursorValue')
				.returns(true);
			validateStub = sinon.stub(descriptor, 'validate').returns(true);
		});

		it('checks the provided cursor value against the column type', function() {
			descriptor.validateCursorValue(value);

			expect(checkCursorValue).to.be.calledOnce;
			expect(checkCursorValue).to.be.calledOn(descriptor);
			expect(checkCursorValue).to.be.calledWith(value);
		});

		it('checks the value with the validation function, if any', function() {
			descriptor.validateCursorValue(value);

			expect(validateStub).to.be.calledOnce;
			expect(validateStub).to.be.calledOn(descriptor);
			expect(validateStub).to.be.calledWith(value);
		});

		it('skips the validation function, if there is none', function() {
			delete descriptor.validate;

			descriptor.validateCursorValue(value);

			expect(validateStub).to.not.be.called;
		});

		it('returns the provided value', function() {
			expect(descriptor.validateCursorValue(value)).to.equal(value);
		});

		it('throws without calling validation function, if type check fails', function() {
			checkCursorValue.returns(false);

			expect(() => {
				descriptor.validateCursorValue(value);
			}).to.throw(InvalidCursorError)
				.that.satisfies((err: InvalidCursorError) => {
					expect(err.shortMessage).to.equal(
						'Cursor value does not match its column type',
					);
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({ value, columnType });
					return true;
				});
			expect(validateStub).to.not.be.called;
		});

		it('throws if the validation function returns false', function() {
			validateStub.returns(false);

			expect(() => {
				descriptor.validateCursorValue(value);
			}).to.throw(InvalidCursorError)
				.that.satisfies((err: InvalidCursorError) => {
					expect(err.shortMessage).to.equal('Invalid cursor value');
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({ value });
					return true;
				});
		});

		it('uses custom message if returned from the validation function', function() {
			const msg = 'custom error message';
			validateStub.returns(msg);

			expect(() => {
				descriptor.validateCursorValue(value);
			}).to.throw(InvalidCursorError)
				.that.satisfies((err: InvalidCursorError) => {
					expect(err.shortMessage).to.equal(msg);
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({ value });
					return true;
				});
		});
	});

	describe('#getNextCursorValue', function() {
		let values: any[];
		let validateCursorValue: sinon.SinonStub;

		beforeEach(function() {
			values = [ 'foo', 'bar' ];
			validateCursorValue = sinon.stub(descriptor, 'validateCursorValue')
				.returnsArg(0);
		});

		it('validates the first element of the provided values', function() {
			descriptor.getNextCursorValue(values);

			expect(validateCursorValue).to.be.calledOnce;
			expect(validateCursorValue).to.be.calledOn(descriptor);
			expect(validateCursorValue).to.be.calledWith('foo');
		});

		it('returns the first element', function() {
			expect(descriptor.getNextCursorValue(values)).to.equal('foo');
		});
	});
});
