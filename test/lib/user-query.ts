import { ColumnType, Paginator, SortDirection } from '../../lib';
import { QueryBuilder } from 'objection';
import { User } from './user';

export class UserQuery extends Paginator<User> {
	static sorts = {
		default: [
			{
				column: 'role',
				columnType: ColumnType.String,
				direction: SortDirection.Ascending,
			},
			{
				column: 'firstName',
				columnType: ColumnType.String,
				direction: SortDirection.Ascending,
			},
			{
				column: 'lastName',
				columnType: ColumnType.String,
				direction: SortDirection.Ascending,
			},
			{
				column: 'id',
				columnType: ColumnType.Int,
				direction: SortDirection.Ascending,
			},
		],
		reverse: [
			{
				column: 'role',
				columnType: ColumnType.String,
				direction: SortDirection.Descending,
			},
			{
				column: 'firstName',
				columnType: ColumnType.String,
				direction: SortDirection.Descending,
			},
			{
				column: 'lastName',
				columnType: ColumnType.String,
				direction: SortDirection.Descending,
			},
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
