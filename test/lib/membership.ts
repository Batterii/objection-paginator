import { Model } from 'objection';
import { User } from './user';

export class Membership extends Model {
	static tableName = 'memberships';

	id: number;
	projectId: number;
	userId: number;
	role: string;
	user?: User;
}
