import { ColumnType, Paginator, SortDirection } from '../../lib';
import { QueryBuilder } from 'objection';
import { User } from './user';

export class UserQuery extends Paginator<User> {
	static sorts = {
		default: [
			'role',
			'firstName',
			'lastName',
			{ column: 'id', columnType: ColumnType.Int },
		],
		reverse: [
			{ column: 'role', direction: SortDirection.Descending },
			{ column: 'firstName', direction: SortDirection.Descending },
			{ column: 'lastName', direction: SortDirection.Descending },
			{
				column: 'id',
				columnType: ColumnType.Int,
				direction: SortDirection.Descending,
			},
		],
	};

	getBaseQuery(): QueryBuilder<User> {
		return User.query();
	}
}
