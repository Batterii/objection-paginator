import { Membership } from './membership';
import { Model } from 'objection';

export class User extends Model {
	static tableName = 'users';
	static relationMappings = {
		memberships: {
			relation: Model.HasManyRelation,
			modelClass: Membership,
			join: {
				from: 'users.id',
				to: 'memberships.userId',
			},
		},
	};

	id: number;
	firstName: string;
	lastName: string;
	role: string;

	memberships?: Membership[];

	get name(): string {
		return `${this.firstName} ${this.lastName}`;
	}
}
