import { ColumnType, Paginator } from '../../lib';
import { QueryBuilder } from 'objection';
import { User } from './user';

export interface MemberQueryArgs {
	projectId: number;
}

export class MemberQuery extends Paginator<User, MemberQueryArgs> {
	static sorts = {
		default: [
			{ column: 'memberships.role', valuePath: 'memberships.0.role' },
			'firstName',
			'lastName',
			{
				column: 'users.id',
				columnType: ColumnType.Int,
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
