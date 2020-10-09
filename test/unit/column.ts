import {QueryBuilder as KnexQueryBuilder, Sql} from "knex";
import {Model, QueryBuilder} from "objection";
import {Column} from "../../lib/column";
import {ConfigurationError} from "../../lib/configuration-error";
import {FakeQuery} from "@batterii/fake-query";
import {expect} from "chai";
import sinon from "sinon";

describe("Column", function() {
	it("stores the provide column and table names", function() {
		const column = new Column("foo", "bar");

		expect(column.columnName).to.equal("foo");
		expect(column.tableName).to.equal("bar");
	});

	it("supports omitting the table name", function() {
		const column = new Column("foo");

		expect(column.columnName).to.equal("foo");
		expect(column.tableName).to.be.undefined;
	});

	describe("::validate", function() {
		it("returns the provided column identifier, if it is valid", function() {
			expect(Column.validate("foo.bar")).to.equal("foo.bar");
		});

		it("allows implicit table names", function() {
			expect(Column.validate("foo")).to.equal("foo");
		});

		it("throws if there are more than two terms", function() {
			expect(() => {
				Column.validate("foo.bar.baz");
			}).to.throw(ConfigurationError).that.includes({
				message: "Invalid column identifier 'foo.bar.baz'",
				cause: null,
				info: null,
			});
		});

		it("throws if the column name is empty", function() {
			expect(() => {
				Column.validate("foo.");
			}).to.throw(ConfigurationError).that.includes({
				message: "Invalid column identifier 'foo.'",
				cause: null,
				info: null,
			});
		});

		it("throws if the table name is empty", function() {
			expect(() => {
				Column.validate(".bar");
			}).to.throw(ConfigurationError).that.includes({
				message: "Invalid column identifier '.bar'",
				cause: null,
				info: null,
			});
		});

		it("throws for an empty string", function() {
			expect(() => {
				Column.validate("");
			}).to.throw(ConfigurationError).that.includes({
				message: "Invalid column identifier ''",
				cause: null,
				info: null,
			});
		});
	});

	describe("::parse", function() {
		it("creates an instance from a full dot-separated identifier", function() {
			const result = Column.parse("foo.bar");

			expect(result).to.be.an.instanceOf(Column);
			expect(result.columnName).to.equal("bar");
			expect(result.tableName).to.equal("foo");
		});

		it("omits the table name if there are no dots", function() {
			const result = Column.parse("baz");

			expect(result).to.be.an.instanceOf(Column);
			expect(result.columnName).to.equal("baz");
			expect(result.tableName).to.be.undefined;
		});

		it("ignores extra preceding terms, if any", function() {
			const result = Column.parse("foo.bar.baz");

			expect(result).to.be.an.instanceOf(Column);
			expect(result.columnName).to.equal("baz");
			expect(result.tableName).to.equal("bar");
		});
	});

	describe("::extractFromSql", function() {
		it("creates an instance from a simple Knex SQL string with double-quoted identfiers", function() {
			const result = Column.extractFromSql("select \"foo\" from \"bar\"");

			expect(result).to.be.an.instanceOf(Column);
			expect(result!.columnName).to.equal("\"foo\"");
			expect(result!.tableName).to.equal("\"bar\"");
		});

		it("omits the table name from the result, if specified", function() {
			const result = Column.extractFromSql("select \"foo\" from \"bar\"", true);

			expect(result).to.be.an.instanceOf(Column);
			expect(result!.columnName).to.equal("\"foo\"");
			expect(result!.tableName).to.be.undefined;
		});

		it("supports backtick-quoted identifiers", function() {
			const result = Column.extractFromSql("select `foo` from `bar`");

			expect(result).to.be.an.instanceOf(Column);
			expect(result!.columnName).to.equal("`foo`");
			expect(result!.tableName).to.equal("`bar`");
		});

		it("supports backticks in double-quoted identifiers", function() {
			const result = Column.extractFromSql("select \"fo`o\" from \"b`ar\"");

			expect(result).to.be.an.instanceOf(Column);
			expect(result!.columnName).to.equal("\"fo`o\"");
			expect(result!.tableName).to.equal("\"b`ar\"");
		});

		it("supports double quotes in backtick-quoted identifiers", function() {
			const result = Column.extractFromSql("select `f\"oo` from `ba\"r`");

			expect(result).to.be.an.instanceOf(Column);
			expect(result!.columnName).to.equal("`f\"oo`");
			expect(result!.tableName).to.equal("`ba\"r`");
		});

		it("returns null if the SQL string does not match any expected format", function() {
			const result = Column.extractFromSql("select foo from bar");

			expect(result).to.be.null;
		});
	});

	describe("::toRaw", function() {
		const str = "column identifier string";
		const rawStr = "raw column identifier string";
		let qry: QueryBuilder<Model>;
		let column: sinon.SinonStubbedInstance<Column>;
		let parse: sinon.SinonStub;
		let rawColumn: sinon.SinonStubbedInstance<Column>;

		beforeEach(function() {
			qry = {} as QueryBuilder<Model>;
			column = sinon.createStubInstance(Column);
			parse = sinon.stub(Column, "parse").returns(column);
			rawColumn = sinon.createStubInstance(Column);
			column.toRaw.returns(rawColumn);
			rawColumn.serialize.returns(rawStr);
		});

		it("parses the provided string as a column", function() {
			Column.toRaw(str, qry);

			expect(parse).to.be.calledOnce;
			expect(parse).to.be.calledOn(Column);
			expect(parse).to.be.calledWith(str);
		});

		it("converts the parsed column to raw", function() {
			Column.toRaw(str, qry);

			expect(column.toRaw).to.be.calledOnce;
			expect(column.toRaw).to.be.calledOn(column);
			expect(column.toRaw).to.be.calledWith(sinon.match.same(qry));
		});

		it("serializes the raw column", function() {
			Column.toRaw(str, qry);

			expect(rawColumn.serialize).to.be.calledOnce;
			expect(rawColumn.serialize).to.be.calledOn(rawColumn);
		});

		it("returns the serialized raw column", function() {
			expect(Column.toRaw(str, qry)).to.equal(rawStr);
		});
	});

	describe("clone", function() {
		it("returns a copy of the instance", function() {
			const column = new Column("foo", "bar");

			const result = column.clone();

			expect(result).to.be.an.instanceOf(Column);
			expect(result.columnName).to.equal("foo");
			expect(result.tableName).to.equal("bar");
			expect(result).to.not.equal(column);
		});
	});

	describe("#getMappingQuery", function() {
		const columnName = "column name";
		const tableName = "table name";
		let column: Column;
		let clone: FakeQuery;
		let qry: QueryBuilder<Model>;

		beforeEach(function() {
			column = new Column(columnName, tableName);
			clone = new FakeQuery();
			qry = {
				clone: sinon.stub().named("clone").returns(clone.builder),
			} as any;
		});

		it("clones the provided query builder", function() {
			column.getMappingQuery(qry);

			expect(qry.clone).to.be.calledOnce;
			expect(qry.clone).to.be.calledOn(qry);
		});

		it("clears the cloned query and applies a simple SELECT FROM", function() {
			column.getMappingQuery(qry);

			expect(clone.stubNames).to.deep.equal([
				"clear",
				"select",
				"from",
			]);
			expect(clone.stubs.clear).to.be.calledOnce;
			expect(clone.stubs.clear).to.be.calledOn(clone.builder);
			expect(clone.stubs.clear).to.be.calledWith(/.*/);
			expect(clone.stubs.select).to.be.calledOnce;
			expect(clone.stubs.select).to.be.calledOn(clone.builder);
			expect(clone.stubs.select).to.be.calledWith(columnName);
			expect(clone.stubs.from).to.be.calledOnce;
			expect(clone.stubs.from).to.be.calledOn(clone.builder);
			expect(clone.stubs.from).to.be.calledWith(tableName);
		});

		it("returns the cloned query", function() {
			expect(column.getMappingQuery(qry)).to.equal(clone.builder);
		});

		it("uses a default table name if there is none", function() {
			column.tableName = undefined;

			const result = column.getMappingQuery(qry);

			expect(clone.stubNames).to.deep.equal([
				"clear",
				"select",
				"from",
			]);
			expect(clone.stubs.clear).to.be.calledOnce;
			expect(clone.stubs.clear).to.be.calledOn(clone.builder);
			expect(clone.stubs.clear).to.be.calledWith(/.*/);
			expect(clone.stubs.select).to.be.calledOnce;
			expect(clone.stubs.select).to.be.calledOn(clone.builder);
			expect(clone.stubs.select).to.be.calledWith(columnName);
			expect(clone.stubs.from).to.be.calledOnce;
			expect(clone.stubs.from).to.be.calledOn(clone.builder);
			expect(clone.stubs.from).to.be.calledWith("some_table");
			expect(result).to.equal(clone.builder);
		});
	});

	describe("#getMappingSql", function() {
		const sql = "Knex-created sql";
		let column: Column;
		let qry: QueryBuilder<Model>;
		let sqlObj: Sql;
		let knexQuery: KnexQueryBuilder;
		let mappingQuery: QueryBuilder<Model>;
		let getMappingQuery: sinon.SinonStub;

		beforeEach(function() {
			column = new Column("foo", "bar");
			qry = {} as QueryBuilder<Model>;
			sqlObj = {sql} as Sql;
			knexQuery = {
				toSQL: sinon.stub().named("toSQL").returns(sqlObj),
			} as any;
			mappingQuery = {
				toKnexQuery: sinon.stub().named("toKnexQuery")
					.returns(knexQuery),
			} as any;
			getMappingQuery = sinon.stub(column, "getMappingQuery")
				.returns(mappingQuery);
		});

		it("gets the mapping query using the provided query builder", function() {
			column.getMappingSql(qry);

			expect(getMappingQuery).to.be.calledOnce;
			expect(getMappingQuery).to.be.calledOn(column);
			expect(getMappingQuery).to.be.calledWith(sinon.match.same(qry));
		});

		it("converts the mapping query to a knex query", function() {
			column.getMappingSql(qry);

			expect(mappingQuery.toKnexQuery).to.be.calledOnce;
			expect(mappingQuery.toKnexQuery).to.be.calledOn(mappingQuery);
		});

		it("converts the knex qry to a knex Sql object", function() {
			column.getMappingSql(qry);

			expect(knexQuery.toSQL).to.be.calledOnce;
			expect(knexQuery.toSQL).to.be.calledOn(knexQuery);
		});

		it("returns the sql string from the knex Sql object", function() {
			expect(column.getMappingSql(qry)).to.equal(sql);
		});
	});

	describe("#toRaw", function() {
		const sql = "mapping sql";
		let column: Column;
		let qry: QueryBuilder<Model>;
		let getMappingSql: sinon.SinonStub;
		let rawColumn: Column;
		let extractFromSql: sinon.SinonStub;
		let clonedColumn: Column;
		let clone: sinon.SinonStub;

		beforeEach(function() {
			column = new Column("foo", "bar");
			qry = {} as QueryBuilder<Model>;
			getMappingSql = sinon.stub(column, "getMappingSql").returns(sql);
			rawColumn = new Column("baz", "qux");
			extractFromSql = sinon.stub(Column, "extractFromSql")
				.returns(rawColumn);
			clonedColumn = new Column("foo", "bar");
			clone = sinon.stub(column, "clone").returns(clonedColumn);
		});

		it("gets the mapping sql", function() {
			column.toRaw(qry);

			expect(getMappingSql).to.be.calledOnce;
			expect(getMappingSql).to.be.calledOn(column);
			expect(getMappingSql).to.be.calledWith(sinon.match.same(qry));
		});

		it("extracts the raw column from the mapping sql", function() {
			column.toRaw(qry);

			expect(extractFromSql).to.be.calledOnce;
			expect(extractFromSql).to.be.calledOn(Column);
			expect(extractFromSql).to.be.calledWith(sql, false);
		});

		it("returns the raw column", function() {
			expect(column.toRaw(qry)).to.equal(rawColumn);
		});

		it("returns a clone instead, if the raw column comes back null", function() {
			extractFromSql.returns(null);

			const result = column.toRaw(qry);

			expect(clone).to.be.calledOnce;
			expect(clone).to.be.calledOn(column);
			expect(result).to.equal(clonedColumn);
		});

		it("omits the table name when extracting, if the instance has none", function() {
			column.tableName = undefined;

			const result = column.toRaw(qry);

			expect(getMappingSql).to.be.calledOnce;
			expect(getMappingSql).to.be.calledOn(column);
			expect(getMappingSql).to.be.calledWith(sinon.match.same(qry));
			expect(extractFromSql).to.be.calledOnce;
			expect(extractFromSql).to.be.calledOn(Column);
			expect(extractFromSql).to.be.calledWith(sql, true);
			expect(result).to.equal(rawColumn);
		});
	});

	describe("#serialize", function() {
		it("returns instance as a dot-separated column identifier", function() {
			const column = new Column("foo", "bar");

			expect(column.serialize()).to.equal("bar.foo");
		});

		it("omits the table name, if there is none", function() {
			const column = new Column("foo");

			expect(column.serialize()).to.equal("foo");
		});
	});
});
