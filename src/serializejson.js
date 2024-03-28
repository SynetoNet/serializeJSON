/*!
	SerializeJSON library, version 1.0.0 (Mar, 2024)
	Forked from https://github.com/marioizquierdo/jquery.serializeJSON version 3.2.1 (Feb, 2021)

	Copyright (c) 2024 Syneto
	Dual licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
	and GPL (http://www.opensource.org/licenses/gpl-license.php) licenses.
*/

const rCRLF = /\r?\n/g;
const rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i;
const rsubmittable = /^(?:input|select|textarea|keygen)/i;
const rcheckableType = /^(?:checkbox|radio)$/i;

let defaultOptions = {}; // reassign to override option defaults for all serializeJSON calls

const defaultBaseOptions = { // do not modify, use defaultOptions instead
	checkboxUncheckedValue: undefined, // to include that value for unchecked checkboxes (instead of ignoring them)
	useIntKeysAsArrayIndex: false, // name='foo[2]' value='v' => {foo: [null, null, 'v']}, instead of {foo: ['2': 'v']}

	skipFalsyValuesForTypes: [], // skip serialization of falsy values for listed value types
	skipFalsyValuesForFields: [], // skip serialization of falsy values for listed field names

	disableColonTypes: false, // do not interpret ':type' suffix as a type
	customTypes: {}, // extends defaultTypes
	defaultTypes: {
		'string': function (str) { return String(str); },
		'number': function (str) { return Number(str); },
		'boolean': function (str) { let falses = ['false', 'null', 'undefined', '', '0']; return falses.indexOf(str) === -1; },
		'null': function (str) { let falses = ['false', 'null', 'undefined', '', '0']; return falses.indexOf(str) === -1 ? str : null; },
		'array': function (str) { return JSON.parse(str); },
		'object': function (str) { return JSON.parse(str); },
		'skip': null // skip is a special type used to ignore fields
	},
	defaultType: 'string',
};

const isObject = function (obj) { return obj === Object(obj); }; // true for Objects and Arrays
const isUndefined = function (obj) { return obj === void 0; }; // safe check for undefined values
const isValidArrayIndex = function (val) { return /^[0-9]+$/.test(String(val)); }; // 1,2,3,4 ... are valid array indexes
const isArray = Array.isArray || function (obj) { return Object.prototype.toString.call(obj) === '[object Array]'; };

// Validate and set defaults
const setupOpts = function (options) {
	if (options == null) { options = {}; }

	// Validate
	let validOpts = [
		'checkboxUncheckedValue',
		'useIntKeysAsArrayIndex',

		'skipFalsyValuesForTypes',
		'skipFalsyValuesForFields',

		'disableColonTypes',
		'customTypes',
		'defaultTypes',
		'defaultType'
	];
	for (let opt in options) {
		if (validOpts.indexOf(opt) === -1) {
			throw new Error('serializeJSON ERROR: invalid option \'' + opt + '\'. Please use one of ' + validOpts.join(', '));
		}
	}

	// Helper to get options or defaults
	return Object.assign({}, defaultBaseOptions, defaultOptions, options);
};

// Just like jQuery's serializeArray method, returns an array of objects with name and value.
// but also includes the dom element (el) and is handles unchecked checkboxes if the option or data attribute are provided.
const serializeArray = function (opts) {
	if (opts == null) { opts = {}; }

	return Array.from(this.elements ?? this.children).filter(function (el) {
		let type = el.type;

		// Filter with the standard W3C rules for successful controls: http://www.w3.org/TR/html401/interact/forms.html#h-17.13.2
		return el.name && // must contain a name attribute
			!el.matches(':disabled') &&
			rsubmittable.test(el.nodeName) && !rsubmitterTypes.test(type) && // only serialize submittable fields (and not buttons)
			(el.checked || !rcheckableType.test(type) || getCheckboxUncheckedValue(el, opts) != null); // skip unchecked checkboxes (unless using opts)
	}).map(function (el) {
		let type = el.type; // 'input', 'select', 'textarea', 'checkbox', etc.
		let val = el.nodeName.toLowerCase() === 'select' ? getSelectValues(el) : el.value;
		
		if (val == null) {
			return null;
		}

		if (rcheckableType.test(type) && !el.checked) {
			val = getCheckboxUncheckedValue(el, opts);
		}

		if (isArray(val)) {
			if (val.length == 0) {
				return null;
			}

			return val.map(function (val) {
				return { name: el.name, value: val.replace(rCRLF, '\r\n'), el: el };
			});
		}

		return { name: el.name, value: val.replace(rCRLF, '\r\n'), el: el };
	});
};

const getCheckboxUncheckedValue = function (el, opts) {
	let val = el.getAttribute('data-unchecked-value');
	if (val == null) {
		val = opts.checkboxUncheckedValue;
	}

	return val;
};

const getSelectValues = function (select) {
	let options = select && select.options;
	let length = options.length;
	let result = [];
	let opt;

	for (let i = 0; i < length; i++) {
		opt = options[i];

		if (opt.selected) {
			result.push(opt.value || opt.text);
		}
	}

	return result;
};

// Parse value with type function
const applyTypeFunc = function (name, strVal, type, el, typeFunctions) {
	let typeFunc = typeFunctions[type];
	if (!typeFunc) { // quick feedback to user if there is a typo or missconfiguration
		throw new Error('serializeJSON ERROR: Invalid type ' + type + ' found in input name \'' + name + '\', please use one of ' + Object.keys(typeFunctions).join(', '));
	}

	return typeFunc(strVal, el);
};

// Splits a field name into the name and the type. Examples:
//   'foo'           =>  ['foo', '']
//   'foo:boolean'   =>  ['foo', 'boolean']
//   'foo[bar]:null' =>  ['foo[bar]', 'null']
const splitType = function (name) {
	let parts = name.split(':');
	if (parts.length > 1) {
		let t = parts.pop();
		return [parts.join(':'), t];
	} else {
		return [name, ''];
	}
};

// Check if this input should be skipped when it has a falsy value,
// depending on the options to skip values by name or type, and the data-skip-falsy attribute.
const shouldSkipFalsy = function (name, nameSansType, type, el, opts) {
	let skipFromDataAttr = el.getAttribute('data-skip-falsy');
	if (skipFromDataAttr != null) {
		return skipFromDataAttr !== 'false'; // any value is true, except the string 'false'
	}

	let optForFields = opts.skipFalsyValuesForFields;
	if (optForFields && (optForFields.indexOf(nameSansType) !== -1 || optForFields.indexOf(name) !== -1)) {
		return true;
	}

	let optForTypes = opts.skipFalsyValuesForTypes;
	if (optForTypes && optForTypes.indexOf(type) !== -1) {
		return true;
	}

	return false;
};

// Split the input name in programatically readable keys.
// Examples:
// 'foo'              => ['foo']
// '[foo]'            => ['foo']
// 'foo[inn][bar]'    => ['foo', 'inn', 'bar']
// 'foo[inn[bar]]'    => ['foo', 'inn', 'bar']
// 'foo[inn][arr][0]' => ['foo', 'inn', 'arr', '0']
// 'arr[][val]'       => ['arr', '', 'val']
const splitInputNameIntoKeysArray = function (nameWithNoType) {
	let keys = nameWithNoType.split('['); // split string into array
	keys = keys.map(function (key) { return key.replace(/\]/g, ''); }); // remove closing brackets
	if (keys[0] === '') { keys.shift(); } // ensure no opening bracket ('[foo][inn]' should be same as 'foo[inn]')

	return keys;
};

// Set a value in an object or array, using multiple keys to set in a nested object or array.
// This is the main function of the script, that allows serializeJSON to use nested keys.
// Examples:
//
// deepSet(obj, ['foo'], v)               // obj['foo'] = v
// deepSet(obj, ['foo', 'inn'], v)        // obj['foo']['inn'] = v // Create the inner obj['foo'] object, if needed
// deepSet(obj, ['foo', 'inn', '123'], v) // obj['foo']['arr']['123'] = v //
//
// deepSet(obj, ['0'], v)                                   // obj['0'] = v
// deepSet(arr, ['0'], v, {useIntKeysAsArrayIndex: true})   // arr[0] = v
// deepSet(arr, [''], v)                                    // arr.push(v)
// deepSet(obj, ['arr', ''], v)                             // obj['arr'].push(v)
//
// arr = [];
// deepSet(arr, ['', v]          // arr => [v]
// deepSet(arr, ['', 'foo'], v)  // arr => [v, {foo: v}]
// deepSet(arr, ['', 'bar'], v)  // arr => [v, {foo: v, bar: v}]
// deepSet(arr, ['', 'bar'], v)  // arr => [v, {foo: v, bar: v}, {bar: v}]
//
const deepSet = function (o, keys, value, opts) {
	if (opts == null) { opts = {}; }
	if (isUndefined(o)) { throw new Error('ArgumentError: param \'o\' expected to be an object or array, found undefined'); }
	if (!keys || keys.length === 0) { throw new Error('ArgumentError: param \'keys\' expected to be an array with least one element'); }

	let key = keys[0];

	// Only one key, then it's not a deepSet, just assign the value in the object or add it to the array.
	if (keys.length === 1) {
		if (key === '') { // push values into an array (o must be an array)
			o.push(value);
		} else {
			o[key] = value; // keys can be object keys (strings) or array indexes (numbers)
		}

		return;
	}

	let nextKey = keys[1]; // nested key
	let tailKeys = keys.slice(1); // list of all other nested keys (nextKey is first)

	if (key === '') { // push nested objects into an array (o must be an array)
		let lastIdx = o.length - 1;
		let lastVal = o[lastIdx];

		// if the last value is an object or array, and the new key is not set yet
		if (isObject(lastVal) && isUndefined(deepGet(lastVal, tailKeys))) {
			key = lastIdx; // then set the new value as a new attribute of the same object
		} else {
			key = lastIdx + 1; // otherwise, add a new element in the array
		}
	}

	if (nextKey === '') { // '' is used to push values into the nested array 'array[]'
		if (isUndefined(o[key]) || !isArray(o[key])) {
			o[key] = []; // define (or override) as array to push values
		}
	} else {
		if (opts.useIntKeysAsArrayIndex && isValidArrayIndex(nextKey)) { // if 1, 2, 3 ... then use an array, where nextKey is the index
			if (isUndefined(o[key]) || !isArray(o[key])) {
				o[key] = []; // define (or override) as array, to insert values using int keys as array indexes
			}
		} else { // nextKey is going to be the nested object's attribute
			if (isUndefined(o[key]) || !isObject(o[key])) {
				o[key] = {}; // define (or override) as object, to set nested properties
			}
		}
	}

	// Recursively set the inner object
	deepSet(o[key], tailKeys, value, opts);
};

const deepGet = function (o, keys) {
	if (isUndefined(o) || isUndefined(keys) || keys.length === 0 || (!isObject(o) && !isArray(o))) {
		return o;
	}
	let key = keys[0];
	if (key === '') { // '' means next array index (used by deepSet)
		return undefined;
	}
	if (keys.length === 1) {
		return o[key];
	}
	let tailKeys = keys.slice(1);
	return deepGet(o[key], tailKeys);
};

const serializeJSON = function (form, options) {
	let opts = setupOpts(options); // validate options and apply defaults
	let typeFunctions = Object.assign({}, opts.defaultTypes, opts.customTypes);

	// Make a list with {name, value, el} for each input element
	let serializedArray = serializeArray.call(form, opts);

	// Convert the serializedArray into a serializedObject with nested keys
	let serializedObject = {};
	serializedArray.forEach(function addObjectToResult(obj) {
		if (obj === null) {
			return;
		}
		if (isArray(obj)) {
			obj.forEach(addObjectToResult);
			return;
		}
		let nameSansType = obj.name;
		let type = obj.el.getAttribute('data-value-type');

		if (!type && !opts.disableColonTypes) { // try getting the type from the input name
			let p = splitType(obj.name); // 'foo:string' => ['foo', 'string']
			nameSansType = p[0];
			type = p[1];
		}
		if (type === 'skip') {
			return; // ignore fields with type skip
		}
		if (!type) {
			type = opts.defaultType; // 'string' by default
		}

		let typedValue = applyTypeFunc(obj.name, obj.value, type, obj.el, typeFunctions); // Parse type as string, number, etc.

		if (!typedValue && shouldSkipFalsy(obj.name, nameSansType, type, obj.el, opts)) {
			return; // ignore falsy inputs if specified in the options
		}

		let keys = splitInputNameIntoKeysArray(nameSansType);
		deepSet(serializedObject, keys, typedValue, opts);
	});
	return serializedObject;
};

const setDefaultOptions = function (options) {
	defaultOptions = options;
};

export {
	deepGet,
	deepSet,
	defaultOptions,
	serializeArray,
	serializeJSON,
	setDefaultOptions,
	splitInputNameIntoKeysArray,
	splitType
};

export default serializeJSON;
