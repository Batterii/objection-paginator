import {
	InvalidJsonError,
	decodeObject,
	encodeObject,
} from "@batterii/encode-object";
import {isArray, isObjectLike, isString} from "lodash";
import {InvalidCursorError} from "./invalid-cursor-error";
import {is} from "nani";

/**
 * Describes the structure of cursor objects in transit.
 *
 * @remarks
 * Properties here have abbreviated names to avoid wasting network resources.
 */
export interface CursorObj {
	/**
	 * The Paginator's query name.
	 */
	q: string;

	/**
	 * The Paginator's sort name.
	 */
	s: string;

	/**
	 * The cursor values, if any.
	 */
	v?: any[];
}

/**
 * An internal class which represents a decoded cursor.
 *
 * @remarks
 * This class is responsible for serialization and parsing of cursors, as well
 * as some initial validation that does not depend on sort configuration.
 */
export class Cursor {
	/**
	 * The Paginator's query name.
	 */
	query: string;

	/**
	 * The Paginator's sort name.
	 */
	sort: string;

	/**
	 * The cursor's values, if any.
	 */
	values?: any[];

	/**
	 * Creates a Cursor.
	 * @param query - The query name from the Paginator.
	 * @param sort - The sort name from the Paginator.
	 * @param values - The cursor's values, if any.
	 */
	constructor(query: string, sort: string, values?: any[]) {
		this.query = query;
		this.sort = sort;
		this.values = values;
	}

	/**
	 * Creates a Cursor from its abbreviated object form.
	 * @param obj - The abbreviated object form.
	 * @returns The created Cursor.
	 */
	static fromObject(obj: CursorObj): Cursor {
		return new Cursor(obj.q, obj.s, obj.v);
	}

	/**
	 * Validates a parsed cursor object, still in its abbreviated form.
	 *
	 * @remarks
	 * This method will throw if the value does not conform to the CursorObj
	 * interface. It is needed to ensure our cursor typings remain correct at
	 * runtime.
	 *
	 * @param value - The abbreviated object form.
	 * @returns The unmutated value.
	 */
	static validateObject(value: any): CursorObj {
		if (!isObjectLike(value)) {
			throw new InvalidCursorError(
				"Cursor is not object-like",
				{info: {cursor: value}},
			);
		}

		if (!isString(value.q)) {
			throw new InvalidCursorError(
				"Cursor 'q' is not a string",
				{info: {q: value.q}},
			);
		}

		if (!isString(value.s)) {
			throw new InvalidCursorError(
				"Cursor 's' is not a string",
				{info: {s: value.s}},
			);
		}

		if (value.v !== undefined && !isArray(value.v)) {
			throw new InvalidCursorError(
				"Cursor 'v' is not an array",
				{info: {v: value.v}},
			);
		}

		return value;
	}

	/**
	 * Creates a Cursor from a serialized string.
	 * @param str - The serialized cursor string.
	 * @returns The created cursor.
	 */
	static parse(str: string): Cursor {
		let obj: unknown;
		try {
			obj = decodeObject(str);
		} catch (err) {
			if (!is(err, InvalidJsonError)) throw err;
			throw new InvalidCursorError({
				shortMessage: "Cursor contains invalid JSON",
				cause: err,
				info: {cursor: str},
			});
		}
		return Cursor.fromObject(Cursor.validateObject(obj));
	}

	/**
	 * Converts a Cursor into its abbreviated object form, in preparation for
	 * serialization.
	 * @returns The abbreviated cursor object.
	 */
	toObject(): CursorObj {
		const obj: CursorObj = {q: this.query, s: this.sort};
		if (this.values) obj.v = this.values;
		return obj;
	}

	/**
	 * Converts a cursor to a serialized string.
	 * @returns The serialized cursor string.
	 */
	serialize(): string {
		return encodeObject(this.toObject());
	}
}
