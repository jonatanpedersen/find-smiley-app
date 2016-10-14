import { filterObject, sortObject, limitObject } from './objectified';

export function createSearch (searchIndex, documents) {
  return function search (filter, sort, offset, length) {
  	filter = filter && filter.toLowerCase().split(' ') || [];

  	let filteredDocuments = filterObject(documents, document => filter.every(word => searchIndex.get(document).indexOf(word) > -1));
  	let sortedDocuments = sortObject(filteredDocuments, sort);
  	let limitedDocuments = limitObject(sortedDocuments, offset, length);

  	return limitedDocuments;
  };
}

export function createSearchIndex (documents) {
	return Object.keys(documents).reduce((searchIndex, documentId) => {
    let document = documents[documentId];
		searchIndex.set(document, Object.keys(getUniqueStrings(document)).join(' '));

    return searchIndex;
	}, new Map());
}

function getUniqueStrings (object, map) {
	map = map || {};

	object && Object.keys(object).forEach(key => {
		let value = object[key];

		if (typeof value === 'number') {
			value = value.toString();
			map[value] = true;
		} else if (typeof value === 'string') {
			value = value.toLowerCase();
			map[value] = true;
		} else if (typeof value === 'object') {
			getUniqueStrings(value, map);
		}

		return map;
	});

	return map;
}
