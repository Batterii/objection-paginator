import { BatteriiError } from '@batterii/errors';
import { ObjectionPaginatorError } from '../../lib/objection-paginator-error';
import { expect } from 'chai';

describe('BatteriiPaginatedQueryError', function() {
	it('extends BatteriiError', function() {
		expect(new ObjectionPaginatorError())
			.to.be.an.instanceOf(BatteriiError);
	});
});
