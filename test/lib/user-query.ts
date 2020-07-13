import {ColumnType, Paginator, SortDirection} from "../../lib";
import {User, UserRole} from "./user";
import {QueryBuilder} from "objection";

export class UserQuery extends Paginator<User> {
	static sorts = {
		default: [
			{column: "suspended", columnType: ColumnType.Boolean},
			{column: "role", validate: validateRole},
			{
				column: "score",
				columnType: ColumnType.Float,
				direction: SortDirection.Descending,
			},
			"firstName",
			"lastName",
			{column: "id", columnType: ColumnType.Integer},
		],
		reverse: [
			{
				column: "suspended",
				columnType: ColumnType.Boolean,
				direction: SortDirection.Descending,
			},
			{
				column: "role",
				direction: SortDirection.Descending,
				validate: validateRole,
			},
			{column: "score", columnType: ColumnType.Float},
			{column: "firstName", direction: SortDirection.Descending},
			{column: "lastName", direction: SortDirection.Descending},
			{
				column: "id",
				columnType: ColumnType.Integer,
				direction: SortDirection.Descending,
			},
		],
		byFavoriteFoodId: [
			{
				column: "favoriteFoodId",
				columnType: ColumnType.Integer,
				nullable: true,
			},
			"firstName",
			"lastName",
			{column: "id", columnType: ColumnType.Integer},
		],
		byFavoriteFoodIdReversed: [
			{
				column: "favoriteFoodId",
				columnType: ColumnType.Integer,
				nullable: true,
				direction: SortDirection.Descending,
			},
			{
				column: "first_name",
				direction: SortDirection.Descending,
				valuePath: "firstName",
			},
			{
				column: "last_name",
				direction: SortDirection.Descending,
				valuePath: "lastName",
			},
			{
				column: "id",
				columnType: ColumnType.Integer,
				direction: SortDirection.Descending,
			},
		],
		byFavoriteFoodName: [
			{
				column: "favoriteFood.name",
				nullable: true,
			},
			"firstName",
			"lastName",
			{
				column: "users.id",
				columnType: ColumnType.Integer,
				valuePath: "id",
			},
		],
		byFavoriteFoodNameReversed: [
			{
				column: "favoriteFood.name",
				nullable: true,
				direction: SortDirection.Descending,
			},
			{
				column: "firstName",
				direction: SortDirection.Descending,
			},
			{
				column: "lastName",
				direction: SortDirection.Descending,
			},
			{
				column: "users.id",
				columnType: ColumnType.Integer,
				direction: SortDirection.Descending,
				valuePath: "id",
			},
		],
		byFavoriteFoodNameReversedNullsLast: [
			{
				column: "favoriteFood.name",
				nullable: true,
				direction: SortDirection.DescendingNullsLast,
			},
			{
				column: "firstName",
				direction: SortDirection.Descending,
			},
			{
				column: "lastName",
				direction: SortDirection.Descending,
			},
			{
				column: "users.id",
				columnType: ColumnType.Integer,
				direction: SortDirection.Descending,
				valuePath: "id",
			},
		],
	};

	getBaseQuery(): QueryBuilder<User> {
		const qry = User.query();
		if (this.sort.startsWith("byFavoriteFoodName")) {
			qry.withGraphJoined("favoriteFood");
		}
		return qry;
	}
}

function validateRole(v: any): boolean {
	return Object.values(UserRole).includes(v);
}
