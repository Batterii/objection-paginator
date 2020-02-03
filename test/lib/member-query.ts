import { ColumnType, Paginator, SortDirection } from '../../lib';
import { QueryBuilder } from 'objection';
import { User } from './user';

export interface MemberQueryArgs {
	projectId: number;
}

export class MemberQuery extends Paginator<User, MemberQueryArgs> {
	static sorts = {
		default: [
			{
				column: 'memberships.role',
				columnType: ColumnType.String,
				direction: SortDirection.Ascending,
				valuePath: 'memberships.0.role',
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
				column: 'users.id',
				columnType: ColumnType.Int,
				direction: SortDirection.Ascending,
				valuePath: 'id',
			},
		],
	};

	getBaseQuery(): QueryBuilder<User> {
		return User.query()
			.withGraphJoined('memberships', { joinOperation: 'innerJoin' })
			.where({ projectId: this.args.projectId });
	}
}
