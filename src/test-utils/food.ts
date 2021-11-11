import {Model} from "objection";

export class Food extends Model {
	static tableName = "foods";

	id: number;
	name: string;
}
