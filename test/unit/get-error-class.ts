import {ValidationCase, getErrorClass} from "../../lib/get-error-class";
import {ConfigurationError} from "../../lib/configuration-error";
import {InvalidCursorError} from "../../lib/invalid-cursor-error";
import {expect} from "chai";

describe("getValidationError", function() {
	it("returns ConfugurationError class for Configuration type", function() {
		expect(getErrorClass(ValidationCase.Configuration))
			.to.equal(ConfigurationError);
	});

	it("returns InvalidCursorError class for Cursor case", function() {
		expect(getErrorClass(ValidationCase.Cursor))
			.to.equal(InvalidCursorError);
	});

	it("throws for any other case", function() {
		expect(() => {
			getErrorClass(-1 as ValidationCase);
		}).to.throw(TypeError).that.includes({
			message: "Unknown validation case -1",
		});
	});
});
