import {ColumnType, Paginator} from "..";
import {MemberRole} from "./membership";
import {QueryBuilder} from "objection";
import {User} from "./user";

export interface MemberQueryArgs {
	projectId: number;
	ctx?: any;
}

export class MemberQuery extends Paginator<User, MemberQueryArgs> {
	static sorts = {
		default: [
			{
				column: "memberships.role",
				valuePath: "memberships.0.role",
				validate: (v: any) => {
					if (Object.values(MemberRole).includes(v)) return true;
					return `Unknown member role '${v}'`;
				},
			},
			"firstName",
			"lastName",
			{
				column: "users.id",
				columnType: ColumnType.Integer,
				valuePath: "id",
			},
		],
	};

	getBaseQuery(): QueryBuilder<User> {
		return User.query()
			.withGraphJoined("memberships", {joinOperation: "innerJoin"})
			.where({projectId: this.args.projectId});
	}
}
