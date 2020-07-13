import {Model, Pojo} from "objection";
import {Food} from "./food";
import {Membership} from "./membership";

export enum UserRole {
	RegularUser = "regularUser",
	Administrator = "administrator",
}

export class User extends Model {
	static tableName = "users";
	static relationMappings = {
		memberships: {
			relation: Model.HasManyRelation,
			modelClass: Membership,
			join: {
				from: "users.id",
				to: "memberships.userId",
			},
		},
		favoriteFood: {
			relation: Model.HasOneRelation,
			modelClass: Food,
			join: {
				from: "users.favoriteFoodId",
				to: "foods.id",
			},
		},
	};

	id: number;
	firstName: string;
	lastName: string;
	role: string;
	suspended: boolean;
	score: number;
	favoriteFoodId: number|null;

	memberships?: Membership[];
	favoriteFood?: Food|null;

	get name(): string {
		return `${this.firstName} ${this.lastName}`;
	}

	$parseDatabaseJson(json: Pojo): Pojo {
		/*
		 * SQLite does not have a native boolean type. Knex will convert them
		 * to integers on the way in, but we have to convert them back here.
		 */
		if ("suspended" in json) json.suspended = Boolean(json.suspended);
		return json;
	}
}
