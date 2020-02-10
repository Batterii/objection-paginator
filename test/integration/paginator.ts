import { GetPageOptions, Page } from '../../lib';
import { Model, PartialModelObject, knexSnakeCaseMappers } from 'objection';
import Knex from 'knex';
import { MemberQuery } from '../lib/member-query';
import { Membership } from '../lib/membership';
import { Project } from '../lib/project';
import { User } from '../lib/user';
import { UserQuery } from '../lib/user-query';
import { expect } from 'chai';
import { resolve as resolvePath } from 'path';
import { unlink } from 'fs-extra';

const dbFile = resolvePath(__dirname, '../../test.db');

describe('PaginatedQuery (Integration)', function() {
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
			table.string('role').notNullable().defaultTo('regularUser');
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
			table.string('role').notNullable().defaultTo('regularMember');
			table.unique([ 'projectId', 'userId' ]);
		});

		const users: PartialModelObject<User>[] = [
			{
				firstName: 'Steve',
				lastName: 'Ripberger',
				role: 'administrator',
			},
			{ firstName: 'Terd', lastName: 'Ferguson' },
			{ firstName: 'Dude', lastName: 'Bro' },
			{ firstName: 'Cool', lastName: 'Guy' },
			{ firstName: 'Terd', lastName: 'McGee' },
		];

		const projects: PartialModelObject<Project>[] = [
			{ name: 'Cool Project' },
			{ name: 'Uncool Project' },
		];

		const memberships: PartialModelObject<Membership>[] = [
			{ projectId: 1, userId: 2, role: 'manager' },
			{ projectId: 1, userId: 1 },
			{ projectId: 1, userId: 3 },
			{ projectId: 1, userId: 4 },
			{ projectId: 1, userId: 5 },

			{ projectId: 2, userId: 5, role: 'manager' },
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
		expect(items[1].name).to.equal('Cool Guy');

		// Second page.
		({ items, cursor } = await qry.execute(cursor));
		expect(items).to.have.length(2);
		expect(items[0].name).to.equal('Dude Bro');
		expect(items[1].name).to.equal('Terd Ferguson');

		// Last page.
		({ items, cursor } = await qry.execute(cursor));
		expect(items).to.have.length(1);
		expect(items[0].name).to.equal('Terd McGee');
	});

	it('supports multiple sorts, selected by a string argument', async function() {
		const qry = new UserQuery({ limit: 2, sort: 'reverse' });
		let items: User[];
		let remaining: number;
		let cursor: string;

		// First page.
		({ items, remaining, cursor } = await qry.execute());
		expect(items).to.have.length(2);
		expect(items[0].name).to.equal('Terd McGee');
		expect(items[1].name).to.equal('Terd Ferguson');
		expect(remaining).to.equal(3);

		// Second page.
		({ items, remaining, cursor } = await qry.execute(cursor));
		expect(items).to.have.length(2);
		expect(items[0].name).to.equal('Dude Bro');
		expect(items[1].name).to.equal('Cool Guy');
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

		// // Second page.
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
});
