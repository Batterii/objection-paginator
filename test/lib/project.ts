import { Model } from 'objection';

export class Project extends Model {
	static tableName = 'projects';

	id: number;
	name: string;
}
