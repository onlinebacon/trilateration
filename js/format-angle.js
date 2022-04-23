import * as Angles from '../../jslib/angles.js';

let usingDecimals = false;

export const angle = (val) => {
	if (usingDecimals) return val.toFixed(3)*1 + '';
	return Angles.stringify(val);
};
export const lat = (val) => {
	if (usingDecimals) return val.toFixed(3)*1 + '';
	val = angle(val);
	if (val[0] === '-') {
		val = val.substring(1) + 'N';
	} else {
		val += 'S';
	}
	return val;
};
export const lon = (val) => {
	if (usingDecimals) return val.toFixed(3)*1 + '';
	val = angle(val);
	if (val[0] === '-') {
		val = val.substring(1) + 'W';
	} else {
		val += 'E';
	}
	return val;
};
export const useDecimals = val => usingDecimals = val;
