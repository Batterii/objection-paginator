import { ObjectionPaginatorError } from './objection-paginator-error';

export class UnknownSortError extends ObjectionPaginatorError {
	static getDefaultMessage(info?: Record<string, any>): string {
		let msg = 'Unknown sort';
		if (info && 'sort' in info) msg += `: '${info.sort}'`;
		return msg;
	}
}
