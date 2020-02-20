import * as getErrorClassModule from '../../lib/get-error-class';
import { ColumnType, SortDirection } from '../../lib/sort-descriptor';
import { Model, QueryBuilder } from 'objection';
import { Column } from '../../lib/column';
import { ConcreteSortDescriptor } from '../../lib/concrete-sort-descriptor';
import { ObjectionPaginatorError } from '../../lib/objection-paginator-error';
import _ from 'lodash';
import { expect } from 'chai';
import objectPath from 'object-path';
import sinon from 'sinon';

const { ValidationCase } = getErrorClassModule;
type ValidationCase = getErrorClassModule.ValidationCase;

describe('ConcreteSortDescriptor', function() {
	const column = 'column identifier';
	const columnType = ColumnType.Boolean;
	const direction = SortDirection.DescendingNullsLast;
	const valuePath = 'value path';
	const validate = () => true;
	let descriptor: ConcreteSortDescriptor;

	beforeEach(function() {
		sinon.stub(Column, 'validate').returnsArg(0);
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
		expect(descriptor.nullable).to.be.false;
		expect(descriptor.direction).to.equal(direction);
		expect(descriptor.valuePath).to.equal(valuePath);
		expect(descriptor.validate).to.equal(validate);
	});

	it('supports specifying true for nullable', function() {
		descriptor = new ConcreteSortDescriptor({ column, nullable: true });

		expect(descriptor.nullable).to.be.true;
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
		descriptor = new ConcreteSortDescriptor({ column });

		expect(descriptor.direction).to.equal(SortDirection.Ascending);
	});

	it('uses column name as the default value path', function() {
		descriptor = new ConcreteSortDescriptor({ column });

		expect(descriptor.valuePath).to.equal(column);
	});

	it('does not use a default validation function', function() {
		descriptor = new ConcreteSortDescriptor({ column });

		expect(descriptor.validate).to.be.undefined;
	});

	it('supports specifing descriptor as a string for column name only', function() {
		descriptor = new ConcreteSortDescriptor(column);

		expect(descriptor.column).to.equal(column);
		expect(descriptor.columnType).to.equal(ColumnType.String);
		expect(descriptor.nullable).to.be.false;
		expect(descriptor.direction).to.equal(SortDirection.Ascending);
		expect(descriptor.valuePath).to.equal(column);
		expect(descriptor.validate).to.be.undefined;
	});

	it('validates the column identifier', function() {
		expect(Column.validate).to.be.calledOnce;
		expect(Column.validate).to.be.calledOn(Column);
		expect(Column.validate).to.be.calledWith(column);
	});

	it('throws if an unknown column type was specified', function() {
		const unknown = 'unknown' as ColumnType;

		expect(() => {
			// eslint-disable-next-line no-new
			new ConcreteSortDescriptor({ column, columnType: unknown });
		}).to.throw(TypeError).that.includes({
			message: 'Unknown column type \'unknown\'',
		});
	});

	it('throws if an unknown sort direction was specified', function() {
		const unknown = 'unknown' as SortDirection;

		expect(() => {
			// eslint-disable-next-line no-new
			new ConcreteSortDescriptor({ column, direction: unknown });
		}).to.throw(TypeError).that.includes({
			message: 'Unknown sort direction \'unknown\'',
		});
	});

	describe('@order', function() {
		it('returns \'asc\' for ascending direction', function() {
			descriptor.direction = SortDirection.Ascending;

			expect(descriptor.order).to.equal('asc');
		});

		it('returns \'desc\' for ascending direction', function() {
			descriptor.direction = SortDirection.Descending;

			expect(descriptor.order).to.equal('desc');
		});

		it('returns \'desc\' for descending nulls last direction', function() {
			descriptor.direction = SortDirection.DescendingNullsLast;

			expect(descriptor.order).to.equal('desc');
		});
	});

	describe('@nullOrder', function() {
		it('returns \'asc\' for ascending direction', function() {
			descriptor.direction = SortDirection.Ascending;

			expect(descriptor.nullOrder).to.equal('asc');
		});

		it('returns \'desc\' for ascending direction', function() {
			descriptor.direction = SortDirection.Descending;

			expect(descriptor.nullOrder).to.equal('desc');
		});

		it('returns \'asc\' for descending nulls last direction', function() {
			descriptor.direction = SortDirection.DescendingNullsLast;

			expect(descriptor.nullOrder).to.equal('asc');
		});
	});

	describe('@operator', function() {
		it('returns \'>\' for ascending direction', function() {
			descriptor.direction = SortDirection.Ascending;

			expect(descriptor.operator).to.equal('>');
		});

		it('returns \'<\' for descending direction', function() {
			descriptor.direction = SortDirection.Descending;

			expect(descriptor.operator).to.equal('<');
		});

		it('returns \'<\' for descending nulls last direction', function() {
			descriptor.direction = SortDirection.DescendingNullsLast;

			expect(descriptor.operator).to.equal('<');
		});
	});

	describe('#checkCursorValue', function() {
		const value = 'provided value';
		const isStringResult = 'isString result';
		const isIntegerResult = 'isInteger result';
		const isFiniteResult = 'isFinite result';
		const isBooleanResult = 'isBoolean result';

		beforeEach(function() {
			sinon.stub(_, 'isString').callThrough()
				.withArgs(value).returns(isStringResult as any);
			sinon.stub(_, 'isInteger').callThrough()
				.withArgs(value).returns(isIntegerResult as any);
			sinon.stub(_, 'isFinite').callThrough()
				.withArgs(value).returns(isFiniteResult as any);
			sinon.stub(_, 'isBoolean').callThrough()
				.withArgs(value).returns(isBooleanResult as any);
		});

		it('checks the value with isString, if columnType is string', function() {
			descriptor.columnType = ColumnType.String;

			expect(descriptor.checkCursorValue(value)).to.equal(isStringResult);
		});

		it('checks the value with isString, if columnType is int', function() {
			descriptor.columnType = ColumnType.Integer;

			expect(descriptor.checkCursorValue(value))
				.to.equal(isIntegerResult);
		});

		it('checks the value with isString, if columnType is boolean', function() {
			descriptor.columnType = ColumnType.Boolean;

			expect(descriptor.checkCursorValue(value))
				.to.equal(isBooleanResult);
		});

		it('checks the value with isFinite, if columnType is number', function() {
			descriptor.columnType = ColumnType.Float;

			expect(descriptor.checkCursorValue(value)).to.equal(isFiniteResult);
		});

		it('returns false for any other column type', function() {
			descriptor.columnType = 'other column type' as ColumnType;

			expect(descriptor.checkCursorValue(value)).to.be.false;
		});
	});

	describe('#validateCursorValue', function() {
		const value = 'provided value';
		let validationCase: ValidationCase;
		let checkCursorValue: sinon.SinonStub;
		let validateStub: sinon.SinonStub;

		// A fake error class to make sure we're using getErrorClass.
		class TestValidationError extends ObjectionPaginatorError {}

		beforeEach(function() {
			validationCase = -1 as ValidationCase;
			checkCursorValue = sinon.stub(descriptor, 'checkCursorValue')
				.returns(true);
			validateStub = sinon.stub(descriptor, 'validate').returns(true);
			sinon.stub(getErrorClassModule, 'getErrorClass')
				.withArgs(validationCase).returns(TestValidationError);
		});

		it('checks the provided cursor value against the column type', function() {
			descriptor.validateCursorValue(value, validationCase);

			expect(checkCursorValue).to.be.calledOnce;
			expect(checkCursorValue).to.be.calledOn(descriptor);
			expect(checkCursorValue).to.be.calledWith(value);
		});

		it('checks the value with the validation function, if any', function() {
			descriptor.validateCursorValue(value, validationCase);

			expect(validateStub).to.be.calledOnce;
			expect(validateStub).to.be.calledOn(descriptor);
			expect(validateStub).to.be.calledWith(value);
		});

		it('skips the validation function, if there is none', function() {
			delete descriptor.validate;

			descriptor.validateCursorValue(value, validationCase);

			expect(validateStub).to.not.be.called;
		});

		it('returns the provided value', function() {
			expect(descriptor.validateCursorValue(value, validationCase))
				.to.equal(value);
		});

		it('suports falsy values', function() {
			const result = descriptor.validateCursorValue(
				false,
				validationCase,
			);

			expect(result).to.be.false;
		});

		it('throws without calling validation function, if type check fails', function() {
			checkCursorValue.returns(false);

			expect(() => {
				descriptor.validateCursorValue(value, validationCase);
			}).to.throw(TestValidationError)
				.that.satisfies((err: TestValidationError) => {
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
				descriptor.validateCursorValue(value, validationCase);
			}).to.throw(TestValidationError)
				.that.satisfies((err: TestValidationError) => {
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
				descriptor.validateCursorValue(value, validationCase);
			}).to.throw(TestValidationError)
				.that.satisfies((err: TestValidationError) => {
					expect(err.shortMessage).to.equal(msg);
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({ value });
					return true;
				});
		});

		context('provided value is null', function() {
			it('throws with no other checks if nullable is false', function() {
				expect(() => {
					descriptor.validateCursorValue(null, validationCase);
				}).to.throw(TestValidationError)
					.that.satisfies((err: TestValidationError) => {
						expect(err.shortMessage).to.equal(
							'Cursor value is null, but column is not nullable',
						);
						expect(err.cause).to.be.null;
						expect(err.info).to.deep.equal({ value: null });
						return true;
					});
				expect(checkCursorValue).to.not.be.called;
				expect(validateStub).to.not.be.be.called;
			});

			it('skips type check and proceeds normally is nullable is true', function() {
				descriptor.nullable = true;

				const result = descriptor.validateCursorValue(
					null,
					validationCase,
				);

				expect(checkCursorValue).to.not.be.called;
				expect(validateStub).to.be.calledOnce;
				expect(validateStub).to.be.calledOn(descriptor);
				expect(validateStub).to.be.calledWith(null);
				expect(result).to.be.null;
			});
		});
	});

	describe('#getCursorValue', function() {
		const value = 'cursor value';
		let entity: object;
		let getPath: sinon.SinonStub;
		let validateCursorValue: sinon.SinonStub;

		beforeEach(function() {
			entity = {};
			getPath = sinon.stub(objectPath, 'get').returns(value);
			validateCursorValue = sinon.stub(descriptor, 'validateCursorValue')
				.returnsArg(0);
		});

		it('gets the cursor value from the value path in an entity', function() {
			descriptor.getCursorValue(entity);

			expect(getPath).to.be.calledOnce;
			expect(getPath).to.be.calledWith(
				sinon.match.same(entity),
				valuePath,
			);
		});

		it('validates the cursor value with the configuration case', function() {
			descriptor.getCursorValue(entity);

			expect(validateCursorValue).to.be.calledOnce;
			expect(validateCursorValue).to.be.calledOn(descriptor);
			expect(validateCursorValue).to.be.calledWith(
				value,
				ValidationCase.Configuration,
			);
		});

		it('returns the cursor value', function() {
			expect(descriptor.getCursorValue(entity)).to.equal(value);
		});

		it('replaces undefined cursor values with null', function() {
			getPath.returns(undefined);

			const result = descriptor.getCursorValue(entity);

			expect(validateCursorValue).to.be.calledOnce;
			expect(validateCursorValue).to.be.calledOn(descriptor);
			expect(validateCursorValue).to.be.calledWith(
				null,
				ValidationCase.Configuration,
			);
			expect(result).to.be.null;
		});

		it('supports falsy cursor values', function() {
			getPath.returns(false);

			const result = descriptor.getCursorValue(entity);

			expect(validateCursorValue).to.be.calledOnce;
			expect(validateCursorValue).to.be.calledOn(descriptor);
			expect(validateCursorValue).to.be.calledWith(
				false,
				ValidationCase.Configuration,
			);
			expect(result).to.be.false;
		});
	});

	describe('#getRawColumn', function() {
		const rawColumn = 'raw column name';
		let qry: QueryBuilder<Model>;
		let toRaw: sinon.SinonStub;

		beforeEach(function() {
			qry = {} as QueryBuilder<Model>;
			toRaw = sinon.stub(Column, 'toRaw').returns(rawColumn);
		});

		it('converts the column to raw, using the provided query builder', function() {
			descriptor.getRawColumn(qry);

			expect(toRaw).to.be.calledOnce;
			expect(toRaw).to.be.calledOn(Column);
			expect(toRaw).to.be.calledWith(column, sinon.match.same(qry));
		});

		it('returns the raw column', function() {
			expect(descriptor.getRawColumn(qry)).to.equal(rawColumn);
		});
	});
});
