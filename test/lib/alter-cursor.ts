import { decodeObject, encodeObject } from '@batterii/encode-object';

export function alterCursor(cursor: string, index: number, value: any): string {
	const cursorObj = decodeObject(cursor);
	cursorObj.v[index] = value;
	return encodeObject(cursorObj);
}
