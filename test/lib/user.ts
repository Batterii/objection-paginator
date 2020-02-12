import { Model, Pojo } from 'objection';
import { Membership } from './membership';

export enum UserRole {
	RegularUser = 'regularUser',
	Administrator = 'administrator',
}

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
	suspended: boolean;
	score: number;

	memberships?: Membership[];

	get name(): string {
		return `${this.firstName} ${this.lastName}`;
	}

	$parseDatabaseJson(json: Pojo): Pojo {
		/*
		 * SQLite does not have a native boolean type. Knex will convert them
		 * to integers on the way in, but we have to convert them back here.
		 */
		if ('suspended' in json) json.suspended = Boolean(json.suspended);
		return json;
	}
}
