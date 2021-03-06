import {ConfigurationError} from "../../lib/configuration-error";
import {ObjectionPaginatorError} from "../../lib/objection-paginator-error";
import {expect} from "chai";

describe("ConfigurationError", function() {
	it("extends ObjectionPaginatorError", function() {
		expect(new ConfigurationError())
			.to.be.an.instanceOf(ObjectionPaginatorError);
	});

	describe("::getDefaultMessage", function() {
		it("returns an appropriate message", function() {
			expect(ConfigurationError.getDefaultMessage()).to.equal(
				"Configuration error",
			);
		});
	});
});
