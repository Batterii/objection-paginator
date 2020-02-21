import { Model, QueryBuilder } from 'objection';
import { ConfigurationError } from './configuration-error';

/**
 * An internal utility class for performing operations on user-provided column
 * identifiers.
 *
 * @remarks
 * Ideally the abstractions we're workign with would be good enough that we can
 * just pass column identifiers directly to Objection/Knex, but this is sadly
 * not the case at the moment, largely due to the trickery needed to
 * simultaneously support identifier mappers, while also ordering nulls in our
 * ORDER BY clauses.
 *
 * This class exists mostly to handle that trickery.
 */
export class Column {
	/**
	 * Used to validate column identifiers. Non-matching strings are invalid.
	 *
	 * @remarks
	 * This may seem very simple, and it is. It can be, largely because both
	 * Knex and Objection make assumptions about your column and table names,
	 * most importantly that they will contain no dots.
	 *
	 * This means a column identifier should never have more than one dot in it,
	 * and that dot will be the separator between the table name and the column
	 * name. Any other pattern will break Knex.
	 */
	private static _columnPattern = /^(?:[^.]+\.)?[^.]+$/;

	/**
	 * Used to extract a mapped column and table name from a sql string.
	 *
	 * @remarks
	 * The backticks and casing are exactly the same as Knex outputs here,
	 * though these of course are not part of the SQL standard.
	 *
	 * This pattern will need to be updated if Knex ever changes the
	 * intermediate SQL strings it outputs before normalizing to whatever
	 * specific database you're using, but this is unlikely since it would be a
	 * massively breaking change.
	 */
	private static _sqlPattern = /^select `(.*?)` from `(.*?)`$/;

	/**
	 * The name of the referenced database column.
	 */
	columnName: string;

	/**
	 * The name of the referenced database table.
	 */
	tableName?: string;

	/**
	 * Creates a Column.
	 * @param columnName - The name of the referenced database column.
	 * @param tableName - The name of the referenced database table.
	 */
	constructor(columnName: string, tableName?: string) {
		this.columnName = columnName;
		this.tableName = tableName;
	}

	/**
	 * Validates a column identifier.
	 *
	 * @remarks
	 * This method will throw if the column identifier is invalid.
	 *
	 * Neither Knex nor Objection do any validation of the column identifiers
	 * you provide to them, but they *do* make assumptions about those
	 * identifiers which will cause major problems if you don't follow their
	 * rules.
	 *
	 * Since we are doing our own transformations on column identifiers with
	 * this class, we're opting to actually validate the assumptions we need
	 * to make, just so we don't end up throwing weird errors that don't
	 * explain themselves very well.
	 *
	 * Of course, Knex will still throw weird errors if you, say, give your
	 * queries column or table names with dots in them, for example, but there's
	 * nothing we can really do about that from here.
	 *
	 * @param str - The string to validate.
	 * @returns The unchanged string.
	 */
	static validate(str: string): string {
		if (this._columnPattern.test(str)) return str;
		throw new ConfigurationError(`Invalid column identifier '${str}'`);
	}

	/**
	 * Creates a Column instance from a user-provided column identifier.
	 *
	 * @remarks
	 * This method does not perform any validation on the string. It simply
	 * extracts what information it can. Validation should have already happened
	 * well before this is even called.
	 *
	 * @param str - The user-provided column identifier.
	 * @return The created instance.
	 */
	static parse(str: string): Column {
		const [ columnName, tableName ] = str.split('.').reverse();
		return new this(columnName, tableName);
	}

	/**
	 * Extracts a Column instance from a mapping SQL statement.
	 *
	 * @remarks
	 * The SQL provided here should have been created by the `#getMappingSql`
	 * method of another Column instance.
	 *
	 * If extraction fails, this method simply returns null instead of throwing.
	 * This will cause the the original identifier to be sent to Objection, so
	 * that people who aren't relying on mappers will not be affected.
	 *
	 * @param sql - The mapping SQL statement.
	 * @param omitTableName - If true, the created Column instance will not have
	 *   a table name. Defaults to false.
	 * @returns The extracted Column, or null if extraction failed.
	 */
	static extractFromSql(sql: string, omitTableName = false): Column|null {
		const match = this._sqlPattern.exec(sql);
		if (!match) return null;
		const [ , columnName, tableName ] = match;
		if (omitTableName) return new this(columnName);
		return new this(columnName, tableName);
	}

	/**
	 * Uses a query builder to translate a user-provided column identifier to
	 * its raw database form.
	 *
	 * @remarks
	 * This is the ultimate goal of this class, and the whole oparation is put
	 * together here.
	 *
	 * @param str - The user-provided column identifier.
	 * @param qry - A query builder to which the result of this will be added as
	 *   part of an ORDER BY clause.
	 * @returns The raw database form of `str`.
	 */
	static toRaw(str: string, qry: QueryBuilder<Model>): string {
		return this.parse(str).toRaw(qry).serialize();
	}

	/**
	 * Creates a copy of the Column.
	 * @returns the cloned Column.
	 */
	clone(): Column {
		return new Column(this.columnName, this.tableName);
	}

	/**
	 * Returns a copy of the provided query builder, except with its operations
	 * replaced with a simple `select from` statement.
	 *
	 * @remarks
	 * This simple `select from` statement is what we will use to extract the
	 * mapped identifiers.
	 *
	 * @param qry - The query builder that may contain the needed mappers.
	 * @returns The mapped sql.
	 */
	getMappingQuery(qry: QueryBuilder<Model>): QueryBuilder<Model> {
		return qry.clone().clear(/.*/)
			.select(this.columnName)
			.from(this.tableName || 'some_table');
	}

	/**
	 * Creates mapping query and converts it to a SQL string.
	 * @param qry - The query builder that may contain the needed mappers.
	 * @returns The SQL string.
	 */
	getMappingSql(qry: QueryBuilder<Model>): string {
		return this.getMappingQuery(qry).toKnexQuery().toSQL().sql;
	}

	/**
	 * Converts a Column to its raw database form, using mappers in the
	 * provided query builder.
	 * @param qry - The query builder that may contain the needed mappers.
	 * @returns The raw Column instance.
	 */
	toRaw(qry: QueryBuilder<Model>): Column {
		const sql = this.getMappingSql(qry);
		const raw = Column.extractFromSql(sql, !this.tableName);
		return raw || this.clone();
	}

	/**
	 * Converts a Column instance to its string representation, ready to be
	 * sent to Objection.
	 * @returns The serialized Column.
	 */
	serialize(): string {
		const terms = [ this.columnName ];
		if (this.tableName) terms.unshift(this.tableName);
		return terms.join('.');
	}
}
