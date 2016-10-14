export function sortObject (object, predicate) {
	if (typeof object !== 'object') {
		throw new TypeError('object is not an object');
	}

	if (typeof predicate !== 'function') {
		return object;
	}

 	return Object.keys(object).sort((a,b) => predicate(a).localeCompare(predicate(b))).reduce((memo, key) => { memo[key] = object[key]; return memo; }, {});
}

export function limitObject (object, offset, length) {
 	return Object.keys(object).slice(offset, offset + length).reduce((memo, key) => { memo[key] = object[key]; return memo; }, {});
}

export function filterObject (object, filter) {
	if (!filter) {
		return object;
	}

	return Object.keys(object).reduce((filteredObject, key) => {
		let value = object[key];
		let isMatch = filter(value);

		if (isMatch) {
			filteredObject[key] = value;
		}

		return filteredObject;
	}, {});
}

export function groupObject (object, predicate) {
	if (typeof object !== 'object') {
		throw new TypeError('object is not an object');
	}

	if (typeof predicate !== 'function') {
		throw new TypeError('predicate is not a function');
	}

	return Object.keys(object).reduce((groups, objectKey) => {
		let groupKey = predicate(object[objectKey]);

		groups[groupKey] = groups[groupKey] || {};
		groups[groupKey][objectKey] = object[objectKey];

		return groups;
	}, {});
}

export function mapObject (object, map) {
	if (typeof object !== 'object') {
		throw new TypeError('object is not an object');
	}

	if (typeof map !== 'function') {
		throw new TypeError('map is not a function');
	}

	return Object.keys(object).reduce((newObject, key) => {
		let value = object[key];
		newObject[key] = map(value, key);
		return newObject;
	}, {});
}

export function joinObject (object1, object2, predicate, target) {
	if (typeof object1 !== 'object') {
		throw new TypeError('object1 is not an object');
	}

	if (typeof object2 !== 'object') {
		throw new TypeError('object2 is not an object');
	}

	if (typeof predicate !== 'function') {
		throw new TypeError('predicate is not a function');
	}

	let groups = groupObject(object2, predicate);
	return mapObject(object1, (value, key) => {
		return Object.assign({}, value, { [target]: groups[key]});
	});
}

export function objectValues (object) {
	return Object.keys(object).map(key => object[key]);
}

export function sumObject (object, predicate) {
	if (typeof object !== 'object') {
		throw new TypeError('object is not an object');
	}

	if (typeof predicate !== 'function') {
		throw new TypeError('predicate is not a function');
	}

	return objectValues(object).reduce((sum, value) => sum + (predicate(value) || 0), 0);
}
