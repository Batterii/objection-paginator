import * as encodeObjectModule from "@batterii/encode-object";
import * as nani from "nani";
import {Cursor, CursorObj} from "../../lib/cursor";
import {InvalidCursorError} from "../../lib/invalid-cursor-error";
import _ from "lodash";
import {expect} from "chai";
import sinon from "sinon";

const {InvalidJsonError} = encodeObjectModule;

describe("Cursor", function() {
	const query = "some query name";
	const sort = "some sort name";
	let values: any[];
	let cursor: Cursor;

	beforeEach(function() {
		values = ["foo", "bar"];
		cursor = new Cursor(query, sort, values);
	});

	it("stores the provided query name", function() {
		expect(cursor.query).to.equal(query);
	});

	it("stores the provided sort name", function() {
		expect(cursor.sort).to.equal(sort);
	});

	it("stores the provided values array", function() {
		expect(cursor.values).to.equal(values);
	});

	it("supports omitted values", function() {
		cursor = new Cursor(query, sort);

		expect(cursor.values).to.be.undefined;
	});

	describe("::fromObject", function() {
		let result: Cursor;

		beforeEach(function() {
			result = Cursor.fromObject({q: query, s: sort, v: values});
		});

		it("returns a cursor", function() {
			expect(result).to.be.an.instanceOf(Cursor);
		});

		it("uses 'q' property as query name", function() {
			expect(result.query).to.equal(query);
		});

		it("uses 's' property as sort name", function() {
			expect(result.sort).to.equal(sort);
		});

		it("uses 'v' property as values", function() {
			expect(result.values).to.equal(values);
		});

		it("supports omitted 'v' property", function() {
			result = Cursor.fromObject({q: query, s: sort});

			expect(result.values).to.be.undefined;
		});
	});

	describe("::validateObject", function() {
		let valueAccess: sinon.SinonStub;
		let value: any;
		let isObjectLike: sinon.SinonStub;
		let isString: sinon.SinonStub;
		let isArray: sinon.SinonStub;

		beforeEach(function() {
			valueAccess = sinon.stub()
				.callsFake((obj: any, prop: string|number) => obj[prop]);
			value = new Proxy(
				{q: query, s: sort, v: values},
				{get: valueAccess},
			);
			isObjectLike = sinon.stub(_, "isObjectLike").returns(true);
			isString = sinon.stub(_, "isString").callThrough();
			isArray = sinon.stub(_, "isArray").returns(true);
		});

		it("checks if the provided value is object-like", function() {
			Cursor.validateObject(value);

			expect(isObjectLike).to.be.calledOnce;
			expect(isObjectLike).to.be.calledWith(sinon.match.same(value));
		});

		it("checks if the q, s, and properties are strings", function() {
			Cursor.validateObject(value);

			expect(isString).to.be.calledTwice;
			expect(isString).to.be.calledWith(query);
			expect(isString).to.be.calledWith(sort);
		});

		it("checks if v property is an array", function() {
			Cursor.validateObject(value);

			expect(isArray).to.be.calledOnce;
			expect(isArray).to.be.calledWith(sinon.match.same(values));
		});

		it("returns the value if it checks out", function() {
			expect(Cursor.validateObject(value)).to.equal(value);
		});

		it("throws without property access if value is not object-like", function() {
			isObjectLike.returns(false);

			expect(() => {
				Cursor.validateObject(value);
			}).to.throw(InvalidCursorError)
				.that.satisfies((err: InvalidCursorError) => {
					expect(err.shortMessage).to.equal(
						"Cursor is not object-like",
					);
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({cursor: value});
					return true;
				});
			expect(valueAccess).to.not.be.called;
		});

		it("throws if q property is not a string", function() {
			isString.withArgs(query).returns(false);

			expect(() => {
				Cursor.validateObject(value);
			}).to.throw(InvalidCursorError)
				.that.satisfies((err: InvalidCursorError) => {
					expect(err.shortMessage).to.equal(
						"Cursor 'q' is not a string",
					);
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({q: query});
					return true;
				});
		});

		it("throws if s property is not a string", function() {
			isString.withArgs(sort).returns(false);

			expect(() => {
				Cursor.validateObject(value);
			}).to.throw(InvalidCursorError)
				.that.satisfies((err: InvalidCursorError) => {
					expect(err.shortMessage).to.equal(
						"Cursor 's' is not a string",
					);
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({s: sort});
					return true;
				});
		});

		it("throws if v property is not an array", function() {
			isArray.returns(false);

			expect(() => {
				Cursor.validateObject(value);
			}).to.throw(InvalidCursorError)
				.that.satisfies((err: InvalidCursorError) => {
					expect(err.shortMessage).to.equal(
						"Cursor 'v' is not an array",
					);
					expect(err.cause).to.be.null;
					expect(err.info).to.deep.equal({v: values});
					return true;
				});
		});

		it("supports omitted v property", function() {
			delete value.v;

			const result = Cursor.validateObject(value);

			expect(isArray).to.not.be.called;
			expect(result).to.equal(value);
		});
	});

	describe("::parse", function() {
		const str = "some cursor string";
		let obj: CursorObj;
		let decodeObject: sinon.SinonStub;
		let validateObject: sinon.SinonStub;
		let fromObject: sinon.SinonStub;

		beforeEach(function() {
			obj = {} as CursorObj;
			decodeObject = sinon.stub(encodeObjectModule, "decodeObject")
				.returns(obj);
			validateObject = sinon.stub(Cursor, "validateObject")
				.returnsArg(0);
			fromObject = sinon.stub(Cursor, "fromObject").returns(cursor);
		});

		it("decodes the string with Batterii decodeObject", function() {
			Cursor.parse(str);

			expect(decodeObject).to.be.calledOnce;
			expect(decodeObject).to.be.calledWith(str);
		});

		it("validates the decoded string", function() {
			Cursor.parse(str);

			expect(validateObject).to.be.calledOnce;
			expect(validateObject).to.be.calledOn(Cursor);
			expect(validateObject).to.be.calledWith(sinon.match.same(obj));
		});

		it("creates a cursor from the decoded string", function() {
			Cursor.parse(str);

			expect(fromObject).to.be.calledOnce;
			expect(fromObject).to.be.calledOn(Cursor);
			expect(fromObject).to.be.calledWith(sinon.match.same(obj));
		});

		it("returns the created cursor", function() {
			expect(Cursor.parse(str)).to.equal(cursor);
		});

		context("decodeObject throws", function() {
			let decodeObjectError: Error;
			let is: sinon.SinonStub;

			beforeEach(function() {
				decodeObjectError = new Error("decodeObject error");
				decodeObject.throws(decodeObjectError);

				is = sinon.stub(nani, "is").returns(true);
			});

			it("checks if the error is an InvalidJsonError", function() {
				try {
					Cursor.parse(str);
				} catch (_err) {
					// We don't care whether or not it throws for this test.
				}

				expect(is).to.be.calledOnce;
				expect(is).to.be.calledWith(
					decodeObjectError,
					InvalidJsonError,
				);
			});

			it("wraps an InvalidJsonError with an InvalidCursorError", function() {
				expect(() => {
					Cursor.parse(str);
				}).to.throw(InvalidCursorError)
					.that.satisfies((err: InvalidCursorError) => {
						expect(err.shortMessage).to.equal(
							"Cursor contains invalid JSON",
						);
						expect(err.cause).to.equal(decodeObjectError);
						expect(err.info).to.deep.equal({cursor: str});
						return true;
					});
			});

			it("rethrows all other errors with no change", function() {
				is.returns(false);

				expect(() => {
					Cursor.parse(str);
				}).to.throw(decodeObjectError);
			});
		});
	});

	describe("#toObject", function() {
		it("returns the cursor as a CursorObj", function() {
			const result = cursor.toObject();

			expect(result).to.be.an.instanceOf(Object);
			expect(result).to.have.keys(["q", "s", "v"]);
			expect(result.q).to.equal(query);
			expect(result.s).to.equal(sort);
			expect(result.v).to.equal(values);
		});

		it("omits v key if there are no values", function() {
			delete cursor.values;

			const result = cursor.toObject();

			expect(result).to.be.an.instanceOf(Object);
			expect(result).to.have.keys(["q", "s"]);
			expect(result.q).to.equal(query);
			expect(result.s).to.equal(sort);
		});
	});

	describe("#serialize", function() {
		const encodedObj = "encoded object string";
		let obj: CursorObj;
		let toObject: sinon.SinonStub;
		let encodeObject: sinon.SinonStub;

		beforeEach(function() {
			obj = {} as CursorObj;
			toObject = sinon.stub(cursor, "toObject").returns(obj);
			encodeObject = sinon.stub(encodeObjectModule, "encodeObject")
				.returns(encodedObj);
		});

		it("converts the instance to an object", function() {
			cursor.serialize();

			expect(toObject).to.be.calledOnce;
			expect(toObject).to.be.calledOn(cursor);
		});

		it("encodes the object using Batterii encodeObject", function() {
			cursor.serialize();

			expect(encodeObject).to.be.calledOnce;
			expect(encodeObject).to.be.calledWith(sinon.match.same(obj));
		});

		it("returns the encoded object", function() {
			expect(cursor.serialize()).to.equal(encodedObj);
		});
	});
});
