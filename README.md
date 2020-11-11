# objection-paginator
Object-oriented, value-based pagination for [Objection.js][1].


## Rationale
Objection includes some [query builder methods for pagination][2], but these
are implemented using a simple limit and offset, which comes with certain
[drawbacks][3]. In many use cases-- particularly large datasets and apps with
realtime elements-- you'll want a more efficient and consistent solution in
place.

One more efficient and consistent solution has been variously called "keyset
pagination," "cursor pagination," and "value-based pagination." It involves
having the client send you data about the last-fetched item-- usually called a
"cursor" but not to be confused with actual SQL Cursors-- allowing you to
filter out (with WHERE clauses) any items that occur before it in the sort,
esentially resuming where you left off without risking the duplicate data or
performance problems.

This kind of pagination is much more complex to implement, as the necessary
cursor values are different based on how the data is being sorted. It is
understandable that a library like Objection would not support it by default,
but it is a common need and should probably be implemented somewhere.

For Objection, it is implemented in a few different packages on npm, including
[objection-cursor][4] and [objection-keyset-pagination][5]. This functionality
is absolutely crucial to Batterii, however, so we've opted to implement it
ourselves to ensure reliability and control over features.

Unlike these other libraries in this space, this project is designed with strong
adherance to OOP priciples and has 100% unit test coverage, along with an
extensive suite of integration tests implemented against SQLite. It is also
written in TypeScript, and includes exhaustive documentation comments for easy
perusal using vscode.

It also has robust support for easily specifying various sorting and filtering
methods around the pagination abstraction, including nullable columns and
columns loaded in through relationships. See below for a lengthy explanation of
these features.


## The Paginator Class
`objection-paginator` is designed with OOP principles, so naturally you define
a paginated query by inheriting from a class. In this case, you use the
Paginator class, like so:

```ts
import { Paginator } from 'objection-paginator';
import { Person } from '../models/person';
import { QueryBuilder } from 'objection';

export class People extends Paginator<Person> {
	/*
	 * You can define columns to sort by here. In this case we just specify a
	 * default sort.
	 */
	static sorts = { default: [ 'firstName', 'lastName', 'guid' ] };

	/*
	 * This is an abstract method that must be provided, and should return a
	 * query including the whole data set for your paginator. Note that it is
	 * *not* async. You should return the unexecuted query builder directly, so
	 * that the Paginator can apply all the additional stuff it needs before
	 * executing.
	 */
	getBaseQuery(): QueryBuilder<User> {
		return Person.query();
	}
}

```

This above example defines a simple paginated query across all entities
belonging to the Person model, which will be sorted by firstName, lastName, then
id. When specifying a sort, you want to make sure that the combination of sort
fields will be unique within the query, to ensure a deterministic sort order.
In this case, the combination of firstName and lastName might not be unique,
so we include the Person's unique "guid" string field as well.

You can later execute your query like so:

```ts
import { People } from '../paginators/people';
import { Person } from '../models/person';

async function logSomePeople(): Promise<void> {
	// Create an instance with the limit configured.
	const paginator = new People({ limit: 10 });

	// Get the first page.
	const page = await paginator.execute();

	// This will log the first ten people and the number of people remaining.
	console.log(page.items, page.remaining):

	// Get the second page.
	const nextPage = await paginator.execute(page.cursor);

	// This will log the next ten people, and the new number remaining.
	console.log(nextPage.items, nextPage.remaining);
}

logSomePeople();
```

In an API you typically won't be getting more than one page in a single request,
so you're usually going to be creating an instance of your paginator and
executing it immediately. For this reason, the Paginator class implements the
static `::getPage` method, which is essentially shorthand for the entire
operation:

```js
import { Page } from 'objection-paginator';
import { People } from '../paginators/people';
import { Person } from '../models/person';

async function whateverYourApiFrameworkDoes(
	clientArgs: { limit?: number; cursor?: string },
): Promise<Page<Person>> {
	const { limit, cursor } = clientArgs;
	return People.getPage({ limit, cursor });
}
```

Note that in this case, we are allowing the client to specify the limit and
(as normal) provide the cursor. If the limit is not provided, it defaults to
1000. If the cursor it is not provided, we'll start from the beginning. If it
is, we will resume from it without storing any state for these queries on the
server.

The cursors are simply base64-encoded JSON, but they should be regarded as
opaque by clients, who should simply recieve and send them without caring about
what is actually in them.


## Alternate Sorts
Paginated queries of any kind require a well-defined sorting mechanism, but it
does not always have to be the same one for the same dataset. You can allow your
clients to specify alternate ways of sorting through the same dataset. Just
include them in your static `sorts` property:

```ts
import { Paginator } from 'objection-paginator';
import { Person } from '../models/person';
import { QueryBuilder } from 'objection';

export class People extends Paginator<Person> {
	static sorts = {
		default: [ 'firstName', 'lastName', 'guid' ],
		byLastName: [ 'lastName', 'firstName', 'guid' ],
	};

	getBaseQuery(): QueryBuilder<User> {
		return Person.query();
	}
}
```

Then, when consuming your paginator, you can provide the alternate sort name:

```ts
const page = await People.getPage({ limit: 10, sort: 'byLastName' });
```

## Full Sort Descriptors
Thus far, we have simply been specifying column names for sorts, but there's
more to this story than that. Perhaps you need to change the sort direction.
Cursors also need to be validated to avoid sending invalid queries to the
database and causing unecessary DB errors.

By default, the Paginator assumes that your columns are strings, and your sort direction is
ascending. If you're sorting a column of a different data type, or you need a descending sort, all
you have to do is specify these inside a full sort descriptor object.

If, for example, I'm using an autoincrement integer id instead of a string guid,
and I want to support sorting by height (stored as a float in inches) with
tallest people first, I could do this:

```ts
import {
	ColumnType, // You'll use this enum to specify column types...
	Paginator,
	SortDirection, // ... and this enum to specify sort directions.
} from 'objection-paginator';
import { Person } from '../models/person';
import { QueryBuilder } from 'objection';

export class People extends Paginator<Person> {
	static sorts = {
		default: [
			'firstName',
			'lastName',
			{ column: 'id', columnType: ColumnType.Integer },
		],
		tallestFirst: [
			{
				column: 'height',
				columnType: ColumnType.Float,
				sortDirection: SortDirection.Descending,
			}
			'firstName',
			'lastName',
			{ column: 'id', columnType: ColumnType.Integer },
		],
	};

	getBaseQuery(): QueryBuilder<User> {
		return Person.query();
	}
}
```

In case you are not using TypeScript and these enums aren't useful to you, they
are implemented with string values.

Sort directions match how they are defined in Objection and [Knex][6], with one
additional option:

- 'asc' for an ascending sort.
- 'desc' for descending sort.
- 'descnl' for a descending nulls-last sort.

This final sort direction option is effectively the same as a descending sort,
unless your column is nullable. See the section on nullable columns for more
information.

Supported column types include the following:

- 'string'
- 'integer'
- 'float'
- 'boolean'
- 'date'

Signs, lengths and precisions of these data types are not currently checked. This is done for
simplicity, as these type-checking features are less about preventing all database errors, and more
about helping developers quickly identify obvious problems. The former would be a major challenge
that is outside thie scope of this library.

The date type accepts either javascript Date instances as cursor values, or strings of any kind.
This leverages the `toJSON` method of JS Dates which automatically converts them to ISO strings,
which are commpatible with the date types in all Knex-supported databases.

If you need to specify custom validation, you can do so with the `validate` property of your sort
descriptors. If, for example, I need to ensure that an integer is positive (possibly useful for
unsigned int columns) I might do this:

```ts
{
	column: 'id',
	columnType: ColumnType.Integer,
	validate: (value: number) => value >= 0;
}
```

Unsurprisingly, validation functions should return `true` for valid values, and
`false` for invalid ones. You can also customize the error message for an
invalid value by returning a string instead:

```ts
{
	column: 'id',
	columnType: ColumnType.Integer,
	validate: (value: number) => value >= 0 || 'Value must be non-negative';
}
```


## Relationships
Paginating over a single table is nice, but Objection's real killer feature is
loading related data using methods like [withGraphFetched][7] and
[withGraphJoined][8]. When using the latter of these methods, it is possible to
also sort on the joined columns within your Paginator.

To do this, you may need to give your sort descriptors a `valuePath`, which is
the dot-separated object path at which they can find their cursor values within
your denormalized result objects. You also may need to specify table names in
addition to column names, if you are joining in a table that has some shared
column names. Otherwise you'll end up with ambigious column name errors.

The `valuePath` is actually always present, but it defaults to whatever you
provide as the column name. If you need to specify a full `table.column`
specifier, you may have to update the `valuePath` as well.

If, for example, I have a Food model where each food has a unique integer id,
and I keep track of people's favorite foods using a `favoriteFoodId` column,
I might associate people with their favorite foods like this:

```ts
import { Model } from 'objection';
import { Food } from '../models/food';

export class Person extends Model {
	static tableName = 'people';
	static relationships = {
		favoriteFood: {
			relation: Model.HasOneRelation,
			modelClass: Food,
			join: {
				from: 'people.favoriteFoodId',
				to: 'food.id',
			};
		};
	};

	id: number;
	firstName: string;
	lastName: string;
	favoriteFoodId: number|null;
	favoriteFood?: Food|null;
}

```

Then, I can define a paginated query of people and their favorite foods, sorted
by the name of the food, the person's first name, the person's last name, and
finally the person id:

```ts
import {
	ColumnType,
	Paginator,
	SortDirection,
} from 'objection-paginator';
import { Person } from '../models/person';
import { QueryBuilder } from 'objection';

export class PeopleWithFavoriteFoods extends Paginator<Person> {
	static sorts = {
		default: [
			/*
			 * The column we're sorting by is the `name` column in the `foods`
			 * table. Note that Objection uses the relationship name as a table
			 * alias for the joined 'foods' table, so you should refer to it
			 * with that alias, if needed.
			 *
			 * This has the added benefit of matching our valuePath exactly,
			 * removing the need to specify both.
			 */
			'favoriteFood.name',
			'firstName',
			'lastName',
			{
				/*
				 * We need to specify which id we're talking about here, since
				 * the `foods` table has its own id column.
				 *
				 * This means we also have to specify the value path, since it
				 * no longer matches the column identifier.
				 */
				column: 'people.id',
				columnType: ColumnType.Integer,
				valuePath: 'id',
			},
		],
	};

	getBaseQuery(): QueryBuilder<User> {
		return Person.query().withGraphJoined('favoriteFood', {
			/*
			 * We are doing an inner join here to filter out people who don't
			 * have a known favorite food. If you need to include records with
			 * nullable columns or relationships, see the section on nullable
			 * columns below.
			 */
			joinOperation: 'innerJoin',
		});
	}
}
```

## Concerning Snake Case Mappers
If you are using Objection's Knex-level [snake case mappers][11], you can expect
the column and table names in your sort descriptors to work seamlessly with
those.

If you are using the Objection-level mappers, however, you will need to specify
using the exact identifier names as they appear in the database, as you would
with any `orderBy` or `select` statement. Your model properties will be in
camel case, of course, but this mismatch means that you will need to specify
an explicit valuePath for every single sort descriptor with a column name
consisting of more than one word.

Features to deal with this are possible, but none are planned because at
Batterii we simply never use the Objection-level mappers becuse the Knex-level
ones are so much more consistent and therefore less confusing. If you feel like
you really need them, though, and you find continually specifying the
`valuePath` to be intolerable, feel free to raise it as an issue and we'll look
into it.


## Nullable Columns
If your sort specifies a column that might be null for a given record, you need
to explicitly mark this using the `nullable` option. This will allow nulls
through the cursor validators, and also ensure they are handled properly within
ORDER BY and WHERE clauses applied by the paginator.

If, for example, we have a `height` field in our Person model, but we may or may
not know the height of an individual person. We can account for this by adding
a `nullable: true` to our sort descriptor for the height field, and updating the
sort direction to put nulls last. The reuslt will be people ordered tallest to
shortest, with the people whose height we don't know at the end:

```ts
import {
	ColumnType,
	Paginator,
	SortDirection,
} from 'objection-paginator';
import { Person } from '../models/person';
import { QueryBuilder } from 'objection';

export class People extends Paginator<Person> {
	static sorts = {
		default: [
			'firstName',
			'lastName',
			{ column: 'id', columnType: ColumnType.Integer },
		],
		tallestFirst: [
			{
				column: 'height',
				columnType: ColumnType.Float,
				nullable: true,
				direction: SortDirection.DescendingNullsFirst,
			}
			'firstName',
			'lastName',
			{ column: 'id', columnType: ColumnType.Integer },
		],
	};

	getBaseQuery(): QueryBuilder<User> {
		return Person.query();
	}
}
```

This library explicitly specifies how to sort nulls, so regardless of what
database you are using, nulls will occur last in an ascending sort, first in a
descending sort, and of course last in a descending nulls-first sort.

### Nullable Relationships
Nullable column support works even if the referenced column is from a different
table. If we return to our previous `PeopleWithFavoriteFoods` example, we can
include people with unknown favorite foods at the end of our list like so:

```ts
import {
	ColumnType,
	Paginator,
	SortDirection,
} from 'objection-paginator';
import { Person } from '../models/person';
import { QueryBuilder } from 'objection';

export class PeopleWithFavoriteFoods extends Paginator<Person> {
	static sorts = {
		default: [
			{
				column: 'favoriteFood.name',
				nullable: true,
			}
			'firstName',
			'lastName',
			{
				column: 'people.id',
				columnType: ColumnType.Integer,
				valuePath: 'id',
			},
		],
	};

	getBaseQuery(): QueryBuilder<User> {
		/*
		 * The join operation for `withGraphJoined` defaults to a left join, so
		 * there is no need to specify. The favoriteFood for each person will be
		 * loaded if known, and null if not known.
		 */
		return Person.query().withGraphJoined('favoriteFood');
	}
}
```


## Paginator Arguments
In many cases, you may need to pass in information which is not known when
defining your Paginator subtypes, but *is* known when instantiating them. For
example, you might need to allow a client-specified filter.

Let's say you want to allow a query that includes only people with a certain
first name. To accomplish this in a type-safe manner, simply define an
interface for your arguments, and both the Paginator constructor and the static
`::getPage` method will require them as their second argument.

Provided args will be availble as `this.args` in your `getBaseQuery` method:

```ts
import { ColumnType, Paginator } from 'objection-paginator';
import { Person } from '../models/person';
import { QueryBuilder } from 'objection';

interface PeopleNamedArgs {
	firstName: string;
}

export class PeopleNamed extends Paginator<Person, PeopleNamedArgs> {
	static sorts = {
		/*
		 * We don't need to include the firstName in our sort, because it will
		 * be the same for every result.
		 */
		default: [
			'lastName',
			{ column: 'id', columnType: ColumnType.Integer },
		],
	};

	getBaseQuery(): QueryBuilder<Person> {
		return Person.query().where({ firstName: this.args.firstName });
	}
}
```

Later, the firstName will be required when you actually use your Paginator:

```ts
const page = await PeopleNamed.getPage({ limit: 10 }, { firstName: 'Steve' });
```

Of course, if you are using vanilla JS you can skip defining your types and just
provide the args object as the second constructor or getPage argument, if and
when you need it.

Args introduce some additional considerations for your cursors. A cursor
from the same Paginator and sort name, but with different args, is technically
still valid since it won't cause database errors. It will not, however, produce
the results you probably want. You may end up getting strange results, or
completely empty results.

Clients should therefore take care not to change the arguments they're sending
while also sending cursors from previous requests. An earlier version of this
library attempted to store a hash of arg values within cursors themselves, so
the server could detect this situation and throw an appropriate error, but since
args are so flexible this proved to be more trouble than it was worth.


### Getting Creative With Your Args
Args have a lot of flexibility besides just applying filters to your queries.
If you're using an API framework like [Koa][9], you might want to pass the
`ctx` object to your paginators, so that you can do permissions checks and what
not based on the currently logged-in user.

```ts
import { ColumnType, Page, Paginator } from 'objection-paginator';
import { Person } from '../models/person';
import { QueryBuilder } from 'objection';
import { Context } from '../path/to/my/context/typings';

interface PeopleArgs {
	ctx: Context;
}

export class People extends Paginator<Person, PeopleArgs> {
	// Set up our default sort as normal.
	static sorts = {
		default: [
			'firstName',
			'lastName',
			{ column: 'id', columnType: ColumnType.Integer },
		],
	};

	/*
	 * We're overriding the constructor to do a check against the user's
	 * "maxLimit." We're also defaulting *to* the user's maxLimit, if no limit
	 * was specified, so this has to happen in the constructor.
	 */
	constructor(options: PaginatorOptions, args: PeopleArgs) {
		// Get the user's maxLimit.
		const { maxLimit } = args.ctx.state.currentUser;

		// Assume we want the user's max limit if none was specified.
		if (options.limit === undefined) options.limit = maxLimit;

		// If a user-provided limit was too high, throw an error.
		if (options.limit > maxLimit) {
			throw new Error(`Maximum limit of ${maxLimit} exceeded`);
		}

		// Continue creating the paginator normally...
		super(options, args);
	}

	getBaseQuery(): QueryBuilder<User> {
		return Person.query();
	}

	async execute(cursor?: string): Promise<Page<User>> {
		/*
		 * You can do some pre-execution checks here if you want. For example,
		 * maybe you want to restrict some users to the first page only. The
		 * following code accomplishes this by throwing when a cursor is
		 * specified for such a user.
		 */
		const { currentUser } = args.ctx.state;
		if (cursor && currentUser.firstPageOnly) {
			throw new Error('User can only see the first page of this query');
		}

		// Execute the query like normal.
		const page = await super.execute(cursor);

		/*
		 * You can do post-execution stuff here if you want, also. Maybe this
		 * user isn't allowed to see the emails of the people they're looking
		 * at. So, maybe we want to null those out before returning our
		 * response.
		 *
		 * Depending on the API framework you are using, this may or may not be
		 * the most appropriate place to handle something like this, but the
		 * option is there if you need it.
		 */
		if (!currentUser.canSeeEmails) {
			for (const person of page.items) {
				person.email = null;
			}
		}

		// Now can return the page.
		return page;
	}
}
```


## Custom Generic Paginators
You may find yourself wanting to implement a feature like the maxLimit checks
above, but within a generic class of your own that does not otherwise specify
your TModel or TArgs. This will enable you to reuse the code for your checking
feature in any of your non-generic subtypes that require it.

You can do this by overriding the constructor, but doing so will require you to
re-specify the constructor's typings in the same way they were originally
experessed. This can be a bit messy due to the particulars of how TypeScript
generics work.

To simplify this process, this module exposes the type aliases it uses, so you
can use them yourself. A custom generic Paginator would therefore look something
like this:

```ts
import {
	If,
	Page,
	Paginator,
	PaginatorOptions,
} from 'objection-paginator';
import { Context } from '../path/to/my/context/typings';
import { Model } from 'objection';

/*
 * This will require a ctx argument for every one of your paginators.
 * Non-generic subtypes that need to add their own arguments by extending this
 * interface and providing the new one as TArgs in place of the default.
 */
export interface MyPaginatorArgs {
	ctx: Context;
}

export abstract class MyPaginator<
	TModel extends Model,
	TArgs extends MyPaginatorArgs = PaginatorArgs
> extends Paginator<TModel, TArgs> {
	/*
	 * This is the same implementation as before, just with a generic type
	 * signature. We do need to use this spread operator and If<T> type to get
	 * around some TypeScript weirdness.
	 */
	constructor(options: PaginatorOptions, ...rest: If<TArgs>) {
		const [ args ] = rest;
		const { maxLimit } = args.ctx.state.currentUser;
		if (options.limit === undefined) options.limit = maxLimit;
		if (options.limit > maxLimit) {
			throw new Error(`Maximum limit of ${maxLimit} exceeded`);
		}
		super(options, ...rest);
	}
}

```

It is also possible to override the static `::getPage` method, of course, but
this is not recommended because both ES6 and TypeScript get a little crazy when
it comes to invoking an original static method within an override. Not to
to mention, the real functionality of this class is implemented in the
constructor and its `#execute` method. `::getPage` is just a convenience that
performs one followed by the other.


## Error Handling
This module makes use of [Nani][10] to define the errors it throws within an
easily-checked heirarchy. The errors it exposes are:

- `ObjectionPaginatorError`: The base class of all other errors in this module,
  for namespacing purposes. You won't see any errors thrown of this type that
  aren't one of its subtypes.
- `ConfigurationError`: Thrown when a mistake in encountered in the
  configuration of a Paginator.
- `UnknownSortError`: Thrown when a paginator is executed with a sort name that
  does not exist in its static `sorts` property.
- `InvalidCursorError`: Indicates that a cursor provided to the `execute` method
  of a paginator was invalid. Usually this is a mistake on the part of the
  client.


[1]: https://vincit.github.io/objection.js/
[2]: https://vincit.github.io/objection.js/recipes/paging.html#paging
[3]: https://medium.com/@meganchang_96378/why-facebook-says-cursor-pagination-is-the-greatest-d6b98d86b6c0
[4]: https://www.npmjs.com/package/objection-cursor
[5]: https://www.npmjs.com/package/objection-keyset-pagination
[6]: http://knexjs.org/
[7]: https://vincit.github.io/objection.js/api/query-builder/eager-methods.html#withgraphfetched
[8]: https://vincit.github.io/objection.js/api/query-builder/eager-methods.html#withgraphjoined
[9]: https://koajs.com/
[10]: https://www.npmjs.com/package/nani
[11]: https://vincit.github.io/objection.js/recipes/snake-case-to-camel-case-conversion.html
