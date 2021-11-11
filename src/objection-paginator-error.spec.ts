import {BatteriiError} from "@batterii/errors";
import {ObjectionPaginatorError} from "./objection-paginator-error";
import {expect} from "chai";

describe("ObjectionPaginatorError", function() {
	it("extends BatteriiError", function() {
		expect(new ObjectionPaginatorError())
			.to.be.an.instanceOf(BatteriiError);
	});
});
