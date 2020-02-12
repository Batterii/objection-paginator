import { ColumnType, Paginator, SortDirection } from '../../lib';
import { User, UserRole } from './user';
import { QueryBuilder } from 'objection';

export class UserQuery extends Paginator<User> {
	static sorts = {
		default: [
			{ column: 'suspended', columnType: ColumnType.Boolean },
			{ column: 'role', validate: validateRole },
			{
				column: 'score',
				columnType: ColumnType.Number,
				direction: SortDirection.Descending,
			},
			'firstName',
			'lastName',
			{ column: 'id', columnType: ColumnType.Int },
		],
		reverse: [
			{
				column: 'suspended',
				columnType: ColumnType.Boolean,
				direction: SortDirection.Descending,
			},
			{
				column: 'role',
				direction: SortDirection.Descending,
				validate: validateRole,
			},
			{ column: 'score', columnType: ColumnType.Number },
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

function validateRole(v: any): boolean {
	return Object.values(UserRole).includes(v);
}
