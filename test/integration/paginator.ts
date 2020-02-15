import {
	ColumnType,
	GetPageOptions,
	InvalidCursorError,
	Page,
} from '../../lib';
import { MemberRole, Membership } from '../lib/membership';
import { Model, PartialModelObject, knexSnakeCaseMappers } from 'objection';
import { User, UserRole } from '../lib/user';
import Knex from 'knex';
import { MemberQuery } from '../lib/member-query';
import { Project } from '../lib/project';
import { UserQuery } from '../lib/user-query';
import { alterCursor } from '../lib/alter-cursor';
import { expect } from 'chai';
import { is } from 'nani';
import { resolve as resolvePath } from 'path';
import { unlink } from 'fs-extra';

const dbFile = resolvePath(__dirname, '../../test.db');

describe('Paginator (Integration)', function() {
	let knex: Knex;

	before(async function() {
		knex = Knex({ // eslint-disable-line new-cap
			client: 'sqlite3',
			useNullAsDefault: true,
			connection: {
				filename: resolvePath(__dirname, '../../test.db'),
			},
			...knexSnakeCaseMappers(),
		});

		Model.knex(knex);

		await knex.schema.createTable('users', (table) => {
			table.increments('id').primary();
			table.string('firstName').notNullable();
			table.string('lastName').notNullable();
			table.string('role').notNullable().defaultTo(UserRole.RegularUser);
			table.boolean('suspended').notNullable().defaultTo(false);
			table.float('score').notNullable().defaultTo(0);
		});

		await knex.schema.createTable('projects', (table) => {
			table.increments('id').primary();
			table.string('name').unique().notNullable();
		});

		await knex.schema.createTable('memberships', (table) => {
			table.increments('id').primary();
			table
				.integer('projectId')
				.notNullable()
				.references('id')
				.inTable('projects')
				.onDelete('CASCADE');
			table
				.integer('userId')
				.notNullable()
				.references('id')
				.inTable('users')
				.onDelete('CASCADE');
			table
				.string('role')
				.notNullable()
				.defaultTo(MemberRole.RegularMember);
			table.unique([ 'projectId', 'userId' ]);
		});

		const users: PartialModelObject<User>[] = [
			{
				firstName: 'Steve',
				lastName: 'Ripberger',
				role: UserRole.Administrator,
			},
			{ firstName: 'Terd', lastName: 'Ferguson', score: 0.5 },
			{ firstName: 'Dude', lastName: 'Bro' },
			{ firstName: 'Cool', lastName: 'Guy', suspended: true },
			{ firstName: 'Terd', lastName: 'McGee', score: 0.5 },
		];

		const projects: PartialModelObject<Project>[] = [
			{ name: 'Cool Project' },
			{ name: 'Uncool Project' },
		];

		const memberships: PartialModelObject<Membership>[] = [
			{ projectId: 1, userId: 2, role: MemberRole.Manager },
			{ projectId: 1, userId: 1 },
			{ projectId: 1, userId: 3 },
			{ projectId: 1, userId: 4 },
			{ projectId: 1, userId: 5 },

			{ projectId: 2, userId: 5, role: MemberRole.Manager },
			{ projectId: 2, userId: 3 },
		];

		/* eslint-disable no-await-in-loop */
		for (const user of users) await User.query().insert(user);
		for (const project of projects) await Project.query().insert(project);
		for (const membership of memberships) {
			await Membership.query().insert(membership);
		}
		/* eslint-enable no-await-in-loop */
	});

	after(async function() {
		await knex.destroy();
		await unlink(dbFile);
	});

	it('paginates a query with a default sort', async function() {
		const qry = new UserQuery({ limit: 2 });
		let items: User[];
		let cursor: string;

		// First page.
		({ items, cursor } = await qry.execute());
		expect(items).to.have.length(2);
		expect(items[0].name).to.equal('Steve Ripberger');
		expect(items[1].name).to.equal('Terd Ferguson');

		// Second page.
		({ items, cursor } = await qry.execute(cursor));
		expect(items).to.have.length(2);
		expect(items[0].name).to.equal('Terd McGee');
		expect(items[1].name).to.equal('Dude Bro');

		// Last page.
		({ items, cursor } = await qry.execute(cursor));
		expect(items).to.have.length(1);
		expect(items[0].name).to.equal('Cool Guy');
	});

	it('supports multiple sorts, selected by a string argument', async function() {
		const qry = new UserQuery({ limit: 2, sort: 'reverse' });
		let items: User[];
		let remaining: number;
		let cursor: string;

		// First page.
		({ items, remaining, cursor } = await qry.execute());
		expect(items).to.have.length(2);
		expect(items[0].name).to.equal('Cool Guy');
		expect(items[1].name).to.equal('Dude Bro');
		expect(remaining).to.equal(3);

		// Second page.
		({ items, remaining, cursor } = await qry.execute(cursor));
		expect(items).to.have.length(2);
		expect(items[0].name).to.equal('Terd McGee');
		expect(items[1].name).to.equal('Terd Ferguson');
		expect(remaining).to.equal(1);

		// Last page.
		({ items, remaining } = await qry.execute(cursor));
		expect(items).to.have.length(1);
		expect(items[0].name).to.equal('Steve Ripberger');
		expect(remaining).to.equal(0);
	});

	it('supports arguments provided to the base query', async function() {
		let qry = new MemberQuery({ limit: 2 }, { projectId: 1 });
		let items: User[];
		let remaining: number;
		let cursor: string;

		// First page.
		({ items, remaining, cursor } = await qry.execute());
		expect(items).to.have.length(2);
		expect(items[0].name).to.equal('Terd Ferguson');
		expect(items[1].name).to.equal('Cool Guy');
		expect(remaining).to.equal(3);

		// Second page.
		({ items, remaining, cursor } = await qry.execute(cursor));
		expect(items).to.have.length(2);
		expect(items[0].name).to.equal('Dude Bro');
		expect(items[1].name).to.equal('Steve Ripberger');
		expect(remaining).to.equal(1);

		// Last page.
		({ items, remaining, cursor } = await qry.execute(cursor));
		expect(items).to.have.length(1);
		expect(items[0].name).to.equal('Terd McGee');
		expect(remaining).to.equal(0);

		// Try the other project.
		qry = new MemberQuery({ limit: 2 }, { projectId: 2 });
		({ items, remaining, cursor } = await qry.execute());
		expect(items).to.have.length(2);
		expect(items[0].name).to.equal('Terd McGee');
		expect(items[1].name).to.equal('Dude Bro');
		expect(remaining).to.equal(0);

		// Last page of other project should be empty.
		({ items, remaining } = await qry.execute(cursor));
		expect(items).to.be.empty;
		expect(remaining).to.equal(0);
	});

	it('supports the ::getPage static method', async function() {
		// We can just repeat part of a previous test using ::getPage.
		const options: GetPageOptions = { limit: 2 };
		const args = { projectId: 1 };
		let page: Page<User>;

		// First page.
		page = await MemberQuery.getPage(options, args);
		expect(page.items).to.have.length(2);
		expect(page.items[0].name).to.equal('Terd Ferguson');
		expect(page.items[1].name).to.equal('Cool Guy');
		expect(page.remaining).to.equal(3);

		// Second page
		options.cursor = page.cursor;
		page = await MemberQuery.getPage(options, args);
		expect(page.items).to.have.length(2);
		expect(page.items[0].name).to.equal('Dude Bro');
		expect(page.items[1].name).to.equal('Steve Ripberger');
		expect(page.remaining).to.equal(1);

		// Last page.
		options.cursor = page.cursor;
		page = await MemberQuery.getPage(options, args);
		expect(page.items).to.have.length(1);
		expect(page.items[0].name).to.equal('Terd McGee');
		expect(page.remaining).to.equal(0);
	});

	it('checks cursor query names and sort sort names', async function() {
		const userQuery = new UserQuery();
		const memberQuery = new MemberQuery({}, { projectId: 1 });
		const reverseUserQuery = new UserQuery({ sort: 'reverse' });

		// Get a cursor for a default user query.
		const { cursor: userCursor } = await userQuery.execute();

		// Send it to the member query and make sure it fails properly.
		try {
			await memberQuery.execute(userCursor);
			expect.fail('Promise should have rejected');
		} catch (err) {
			if (!is(err, InvalidCursorError)) throw err;
			expect(err.shortMessage).to.equal(
				'Cursor is for a different query',
			);
			expect(err.cause).to.be.null;
			expect(err.info).to.deep.equal({
				cursorQuery: UserQuery.name,
				expectedQuery: MemberQuery.name,
			});
		}

		// Send it to the reverse user query and make sure it fails properly.
		try {
			await reverseUserQuery.execute(userCursor);
			expect.fail('Promise should have rejected');
		} catch (err) {
			if (!is(err, InvalidCursorError)) throw err;
			expect(err.shortMessage).to.equal(
				'Cursor is for a different sort',
			);
			expect(err.cause).to.be.null;
			expect(err.info).to.deep.equal({
				cursorSort: 'default',
				expectedSort: 'reverse',
			});
		}
	});

	it('validates cursor values against column types', async function() {
		// Create a default user query.
		const userQuery = new UserQuery();

		// Get a cursor that we will alter for these tests.
		const { cursor } = await userQuery.execute();

		// Try with the firstName value as a non-string.
		let invalidCursor = alterCursor(cursor, 3, 42);
		try {
			await userQuery.execute(invalidCursor);
			expect.fail('Promise should have rejected');
		} catch (err) {
			if (!is(err, InvalidCursorError)) throw err;
			expect(err.shortMessage).to.equal(
				'Cursor value does not match its column type',
			);
			expect(err.cause).to.be.null;
			expect(err.info).to.deep.equal({
				columnType: ColumnType.String,
				value: 42,
			});
		}

		// Try with the id value as a non-integer.
		invalidCursor = alterCursor(cursor, 5, 4.2);
		try {
			await userQuery.execute(invalidCursor);
			expect.fail('Promise should have rejected');
		} catch (err) {
			if (!is(err, InvalidCursorError)) throw err;
			expect(err.shortMessage).to.equal(
				'Cursor value does not match its column type',
			);
			expect(err.cause).to.be.null;
			expect(err.info).to.deep.equal({
				columnType: ColumnType.Integer,
				value: 4.2,
			});
		}

		// Try with the score value as an non-number.
		invalidCursor = alterCursor(cursor, 2, 'foo');
		try {
			await userQuery.execute(invalidCursor);
			expect.fail('Promise should have rejected');
		} catch (err) {
			if (!is(err, InvalidCursorError)) throw err;
			expect(err.shortMessage).to.equal(
				'Cursor value does not match its column type',
			);
			expect(err.cause).to.be.null;
			expect(err.info).to.deep.equal({
				columnType: ColumnType.Float,
				value: 'foo',
			});
		}

		// Try with the suspended value as a non-boolean.
		invalidCursor = alterCursor(cursor, 0, 'foo');
		try {
			await userQuery.execute(invalidCursor);
			expect.fail('Promise should have rejected');
		} catch (err) {
			if (!is(err, InvalidCursorError)) throw err;
			expect(err.shortMessage).to.equal(
				'Cursor value does not match its column type',
			);
			expect(err.cause).to.be.null;
			expect(err.info).to.deep.equal({
				columnType: ColumnType.Boolean,
				value: 'foo',
			});
		}
	});

	it('supports custom cursor value validation', async function() {
		// Create a default user query.
		const qry = new UserQuery();

		// Get a cursor for a default user query.
		const { cursor } = await qry.execute();

		// Try with the role as a value outside the enum.
		const invalidCursor = alterCursor(cursor, 1, 'foo');
		try {
			await qry.execute(invalidCursor);
			expect.fail('Promise should have rejected');
		} catch (err) {
			if (!is(err, InvalidCursorError)) throw err;
			expect(err.shortMessage).to.equal('Invalid cursor value');
			expect(err.cause).to.be.null;
			expect(err.info).to.deep.equal({ value: 'foo' });
		}
	});

	it('supports custom validation error messages', async function() {
		// Create a default member query for project 1.
		const qry = new MemberQuery({}, { projectId: 1 });

		// Get a cursor that we will alter for these tests.
		const { cursor } = await qry.execute();

		// Try with the membership role as a value outside the enum.
		const invalidCursor = alterCursor(cursor, 0, 'foo');
		try {
			await qry.execute(invalidCursor);
			expect.fail('Promise should have rejected');
		} catch (err) {
			if (!is(err, InvalidCursorError)) throw err;
			expect(err.shortMessage).to.equal('Unknown member role \'foo\'');
			expect(err.cause).to.be.null;
			expect(err.info).to.deep.equal({ value: 'foo' });
		}
	});
});
