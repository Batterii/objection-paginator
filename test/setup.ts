import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";

// Add assertions from sinon-chai.
chai.use(sinonChai);

// Restore sinon's static sandbox after each test.
afterEach(function() {
	sinon.restore();
});
