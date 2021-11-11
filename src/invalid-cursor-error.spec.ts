import {InvalidCursorError} from "./invalid-cursor-error";
import {ObjectionPaginatorError} from "./objection-paginator-error";
import {expect} from "chai";

describe("InvalidCursorError", function() {
	it("extends ObjectionPaginatorError", function() {
		expect(new InvalidCursorError())
			.to.be.an.instanceOf(ObjectionPaginatorError);
	});

	describe("::getDefaultMessage", function() {
		it("returns an appropriate message", function() {
			expect(InvalidCursorError.getDefaultMessage()).to.equal(
				"Invalid cursor",
			);
		});
	});
});
