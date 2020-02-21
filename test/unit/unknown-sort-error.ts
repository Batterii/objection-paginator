import {
	ObjectionPaginatorError,
} from '../../lib/objection-paginator-error';
import { UnknownSortError } from '../../lib/unknown-sort-error';
import { expect } from 'chai';

describe('UnknownSortError', function() {
	it('extends ObjectionPaginatorError', function() {
		expect(new UnknownSortError())
			.to.be.an.instanceOf(ObjectionPaginatorError);
	});

	describe('#getDefaultMessage', function() {
		it('includes sort if provided in info', function() {
			expect(UnknownSortError.getDefaultMessage({ sort: 'foo' }))
				.to.equal('Unknown sort: \'foo\'');
		});

		it('omits sort if no info is provided', function() {
			expect(UnknownSortError.getDefaultMessage())
				.to.equal('Unknown sort');
		});

		it('omits sort if not included in info', function() {
			expect(UnknownSortError.getDefaultMessage({}))
				.to.equal('Unknown sort');
		});

		it('includes sort, even if empty', function() {
			expect(UnknownSortError.getDefaultMessage({ sort: '' }))
				.to.equal('Unknown sort: \'\'');
		});
	});
});
