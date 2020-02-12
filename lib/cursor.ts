import {
	InvalidJsonError,
	decodeObject,
	encodeObject,
} from '@batterii/encode-object';
import { isArray, isObjectLike, isString } from 'lodash';
import { InvalidCursorError } from './invalid-cursor-error';
import { is } from 'nani';

export interface CursorObj {
	q: string;
	s: string;
	a?: string;
	v?: any[];
}

export class Cursor {
	query: string;
	sort: string;
	values?: any[];
	argsHash?: string;

	constructor(
		query: string,
		sort: string,
		values?: any[],
		argsHash?: string,
	) {
		this.query = query;
		this.sort = sort;
		this.values = values;
		this.argsHash = argsHash;
	}

	static fromObject(obj: CursorObj): Cursor {
		return new Cursor(obj.q, obj.s, obj.v, obj.a);
	}

	static validateObject(value: any): CursorObj {
		if (!isObjectLike(value)) {
			throw new InvalidCursorError(
				'Cursor is not object-like',
				{ info: { cursor: value } },
			);
		}

		if (!isString(value.q)) {
			throw new InvalidCursorError(
				'Cursor \'q\' is not a string',
				{ info: { q: value.q } },
			);
		}

		if (!isString(value.s)) {
			throw new InvalidCursorError(
				'Cursor \'s\' is not a string',
				{ info: { s: value.s } },
			);
		}

		if (value.a !== undefined && !isString(value.a)) {
			throw new InvalidCursorError(
				'Cursor \'a\' is not a string',
				{ info: { a: value.a } },
			);
		}

		if (value.v !== undefined && !isArray(value.v)) {
			throw new InvalidCursorError(
				'Cursor \'v\' is not an array',
				{ info: { v: value.v } },
			);
		}

		return value;
	}

	static parse(str: string): Cursor {
		let obj: unknown;
		try {
			obj = decodeObject(str);
		} catch (err) {
			if (!is(err, InvalidJsonError)) throw err;
			throw new InvalidCursorError({
				shortMessage: 'Cursor contains invalid JSON',
				cause: err,
				info: { cursor: str },
			});
		}
		return Cursor.fromObject(Cursor.validateObject(obj));
	}

	toObject(): CursorObj {
		const obj: CursorObj = { q: this.query, s: this.sort };
		if (this.argsHash) obj.a = this.argsHash;
		if (this.values) obj.v = this.values;
		return obj;
	}

	serialize(): string {
		return encodeObject(this.toObject());
	}
}
