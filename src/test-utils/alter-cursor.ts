import {decodeObject, encodeObject} from "@batterii/encode-object";

/**
 * A utility for integration test. Alters a query string by replacing the value
 * at the provided index with another one.
 *
 * @remarks
 * Typically, clients shouldn't be fiddling about with our cursors. This is
 * used to test what happens if and when they do.
 *
 * @param cursor - The cursor string to alter.
 * @param index - The index of the item to change.
 * @param value - The value to assign over the item at the index.
 * @returns The altered copy of the cursor.
 */
export function alterCursor(cursor: string, index: number, value: any): string {
	const cursorObj = decodeObject(cursor);
	cursorObj.v[index] = value;
	return encodeObject(cursorObj);
}
