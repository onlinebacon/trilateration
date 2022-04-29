import * as Angles from '../../jslib/angles.js';
import * as Almanac from '../../jslib/almanac-2022.js';
import * as Corrections from '../../jslib/cel-nav-corrections.js';
import { trilaterate } from '../../jslib/sphere-trilateration.js';
import { calcDist } from '../../jslib/sphere-math.js';
import { azimuthAltSearch } from './azimuth-alt-search.js';

import * as FormatAngle from './format-angle.js';

const STANDARD_REFRACTION = 1;

const toRadians = (degrees) => degrees*(Math.PI/180);
const toDegrees = (radians) => radians*(180/Math.PI);

const months = [
	'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
	'october', 'november', 'december',
];

const fmtAng = FormatAngle.angle;
const fmtLat = FormatAngle.lat;
const fmtLon = FormatAngle.lon;

class DateTime {
	constructor() {
		this.year = null;
		this.month = null;
		this.day = null;
		this.hour = null;
		this.min = null;
		this.sec = null;
		this.zone = null;
	}
	isMissing() {
		const attrs = [ 'year', 'month', 'day', 'hour', 'min', 'sec', 'zone' ];
		const missing = attrs.find(attr => this[attr] == null);
		if (!missing) return null;
		if ([ 'year', 'month', 'day' ].includes(missing)) {
			return 'year, month and day';
		}
		return missing;
	}
	get timestamp() {
		const { year, month, day, hour, min, sec, zone } = this;
		const y = year.toString().padStart(4, '0');
		const M = month.toString().padStart(2, '0');
		const d = day.toString().padStart(2, '0');
		const h = hour.toString().padStart(2, '0');
		const m = min.toString().padStart(2, '0');
		const s = sec.toFixed(3).padStart(6, '0');
		const iso8601 = `${y}-${M}-${d}T${h}:${m}:${s}${zone}`;
		return new Date(iso8601).getTime();
	}
	set(data) {
		for (const attr in data) {
			const val = data[attr];
			if (val != null) this[attr] = val;
		}
		return this;
	}
}

const zonedDateTimeFormat = {
	regex: /^\d+-\d+-\d+\s+\d+:\d+:\d+(\.\d+)?(\s*(UTC|GMT)\s*|\s*)[+\-]\s*\d+(:\d+)?$/i,
	parse: str => {
		str = str.replace(/\s+/g, '\x20');
		str = str.replace(/([+\-])\s+/, '$1');
		str = str.replace(/UTC|GMT/, '')
		const [ year, month, day, hour, min, sec ] = str.split(/[\-\s:]/).map(Number);
		let [ zone ] = str.match(/[+\-]\s*\d+(:\d+)?$/);
		zone = zone.replace(/\d+/g, d => d.padStart(2, '0'));
		if (!zone.includes(':')) zone += ':00';
		return { year, month, day, hour, min, sec, zone };
	},
};

const timeFormat = {
	regex: /^\d+:\d+(:\d+(\.\d+)?)?(\s*[ap]m)?$/i,
	parse: str => {
		let [ ampm ] = str.match(/[ap]m$/i) ?? [];
		str = str.replace(/\s*[apm]+/ig, '');
		let [ hour, min, sec ] = str.split(':').map(Number);
		if (ampm) {
			if (/pm/i.test(ampm)) {
				if (hour != 12) hour += 12;
			} else if (hour == 12) {
				hour = 0;
			}
		}
		return { hour, min, sec };
	},
};

const dateFormat = {
	regex: /^\w+(\s*,\s*|\s+)\d+(st|nd|rd|th)?(\s*,\s*|\s+)\d+$/i,
	parse: str => {
		str = str.replace(/\s*,\s*|\s+/g, ' ').trim();
		let [ month, day, year ] = str.split(' ');
		month = month.toLowerCase();
		month = months.find(str => str === month || str.substring(0, 3) === month);
		month = months.indexOf(month) + 1;
		day = day.replace(/[a-z]/ig, '');
		day = Number(day);
		year = Number(year);
		return { day, month, year };
	},
};

const zoneFormat = {
	regex: /^(GMT|UTC|((GMT|UTC)\s*)?[+\-]\s*\d+(:\d+)?)$/i,
	parse: str => {
		if (/^(GMT|UTC)$/i.test(str)) return '+00:00';
		str = str.replace(/GMT|UTC/i, '');
		str = str.replace(/\s+/g, ' ');
		str = str.trim();
		let zone = str[0];
		str = str.replace(/[+\-]/, '');
		let [ hour, min = 0 ] = str.split(':').map(Number);
		zone += hour.toString().padStart(2, '0');
		zone += ':';
		zone += min.toString().padStart(2, '0');
		return zone;
	},
};

const heightFormat = {
	regex: /^\d+(\.\d+)?\s*(m|ft)$/i,
	parse: str => {
		let [ unit ] = str.match(/[a-z]+$/g);
		let val = Number(str.replace(/[^\d\.]/g, '').trim());
		if (unit.toLowerCase() === 'ft') val *= 0.3048;
		return val;
	},
};

const northSouthRegex = /^[NS]|[NS]$/;
const eastWestRegex = /^[EW]|[EW]$/;
const parseCoord = (str) => {
	str = str.toUpperCase();
	const pair = str.split(/\s*,\s*/);
	if (pair.length !== 2) return null;
	let [ lat, lon ] = pair;
	if (northSouthRegex.test(lat)) {
		const [ sign ] = lat.match(northSouthRegex);
		lat = lat.replace(northSouthRegex, '').trim();
		if (sign === 'S') lat = '-' + lat;
	}
	if (eastWestRegex.test(lon)) {
		const [ sign ] = lon.match(eastWestRegex);
		lon = lon.replace(eastWestRegex, '').trim();
		if (sign === 'W') lon = '-' + lon;
	}
	lat = Angles.parse(lat);
	if (lat == null) return null;
	lon = Angles.parse(lon);
	if (lon == null) return null;
	return [ lat, lon ].map(toRadians);
};

const setters = {
	time: (ctx, val) => {
		const format = [ zonedDateTimeFormat, timeFormat ].find(format => format.regex.test(val));
		if (!format) {
			throw `Invalid time format "${val}"`;
		}
		const data = format.parse(val);
		const { dt } = ctx.current;
		dt.set(data);
		const missing = dt.isMissing();
		if (missing) {
			throw `Incomplete date/time information: missing ${missing}`;
		}
		const { timestamp } = dt;
		if (isNaN(timestamp)) {
			throw `Invalid time`;
		}
		const ghaOfAries = Almanac.getAriesGHAAt(timestamp);
		ctx.log(`GHA of Aries = ${fmtAng(ghaOfAries)}`);
		ctx.current.ghaOfAries = ghaOfAries;
	},
	date: (ctx, val) => {
		if (!dateFormat.regex.test(val)) {
			throw `Invalid date format "${val}"`;
		}
		const data = dateFormat.parse(val);
		if (data == null) {
			throw `Invalid date "${val}"`;
		}
		const { dt } = ctx.current;
		dt.set(data);
		if (!dt.isMissing() && isNaN(dt.timestamp)) {
			throw `Invalid date "${val}"`;
		}
	},
	zone: (ctx, val) => {
		if (!zoneFormat.regex.test(val)) {
			throw `Invalid zone format "${val}"`;
		}
		const zone = zoneFormat.parse(val);
		if (zone == null) {
			throw `Invalid zone "${val}"`;
		}
		ctx.current.dt.set({ zone });
	},
	index: (ctx, val) => {
		let index = Angles.parse(val);
		if (index == null) {
			throw `Invalid index error "${val}"`;
		}
		ctx.log(`index = ${fmtAng(index)}`);
		ctx.current.index = index;
	},
	height: (ctx, val) => {
		if (!heightFormat.regex.test(val)) {
			throw `Invalid height format "${val}"`;
		}
		const height = heightFormat.parse(val);
		if (height == null) {
			throw `Invalid height "${val}"`;
		}
		const dip = Corrections.dip(height);
		ctx.log(`dip for ${val} = ${fmtAng(dip)}`);
		ctx.current.dip = dip;
	},
	refraction: (ctx, val) => {
		if (/std|standard/i.test(val)) {
			ctx.current.refraction = STANDARD_REFRACTION;
		} else {
			throw `Invalid refraction format "${val}"`;
		}
	},
	body: (ctx, val) => {
		if (ctx.current.body != null) {
			ctx.completeCurrentSight();
		}
		const body = Almanac.lookup(val);
		ctx.log('');
		if (body == null) {
			ctx.log(`- ${val} -`);
			ctx.current.body = { names: [ val ], ra: null, dec: null };
		} else {
			ctx.log(`- ${body.names[0]} -`);
			ctx.current.body = body;
			const ra = fmtAng(body.ra);
			const dec = fmtAng(body.dec);
			ctx.log(`ra/dec (almanac) = ${ra} / ${dec}`);
		}
		ctx.current.zenith = null;
	},
	'ra/dec': (ctx, val) => {
		const args = val.split(/\s*\/\s*/);
		if (args.length !== 2) {
			throw `Invalid ra/dec format "${val}"`;
		}
		let [ ra, dec ] = args.map(Angles.parse);
		if (ra == null) {
			throw `Invalid right ascension "${args[0]}"`;
		}
		if (dec == null) {
			throw `Invalid declination "${args[1]}"`;
		}
		if (ctx.current.body == null) {
			ctx.log('');
			ctx.log(`- Unkown -`);
			ctx.current.body = { names: [ 'Unkown' ], ra, dec };
		} else {
			ra *= 360/24;
			ctx.current.body = { ...ctx.current.body, ra, dec };
		}
	},
	azimuth: (ctx, val) => {
		let azimuth = Angles.parse(val);
		if (azimuth == null) {
			throw `Invalid azimuth "${val}"`;
		}
		ctx.log(`azimuth = ${fmtAng(azimuth)}`);
		ctx.current.azimuth = azimuth;
	},
	zenith: (ctx, val) => {
		let zenith = Angles.parse(val);
		if (zenith == null) {
			throw `Invalid zenith angle "${val}"`;
		}
		ctx.log(`zenith = ${fmtAng(zenith)}`);
		if (ctx.current.refraction === STANDARD_REFRACTION) {
			const dif = Corrections.refraction(90 - zenith);
			const corrected = zenith + dif;
			let msg = 'refraction: ';
			msg += fmtAng(zenith);
			msg += ' + ' + fmtAng(dif);
			msg += ' = ' + fmtAng(corrected);
			ctx.log(msg);
			zenith = corrected;
		}
		ctx.current.zenith = zenith;
	},
	alt: (ctx, val) => {
		let alt = Angles.parse(val);
		if (alt == null) {
			throw `Invalid altitude "${val}"`;
		}
		ctx.log(`alt = ${fmtAng(alt)}`);
		const { index, dip } = ctx.current;
		if (index != null) {
			const corrected = alt - index;
			let msg = 'index: ';
			msg += fmtAng(alt);
			if (index < 0) {
				msg += ' + ' + fmtAng(-index);
			} else {
				msg += ' - ' + fmtAng(index);
			}
			msg += ' = ' + fmtAng(corrected);
			ctx.log(msg);
			alt = corrected;
		}
		if (dip != null) {
			const corrected = alt - dip;
			let msg = 'dip: ';
			msg += fmtAng(alt);
			msg += ' - ' + fmtAng(dip);
			msg += ' = ' + fmtAng(corrected);
			ctx.log(msg);
			alt = corrected;
		}
		if (ctx.current.refraction === STANDARD_REFRACTION) {
			const dif = Corrections.refraction(alt);
			const corrected = alt - dif;
			let msg = 'refraction: ';
			msg += fmtAng(alt);
			msg += ' - ' + fmtAng(dif);
			msg += ' = ' + fmtAng(corrected);
			ctx.log(msg);
			alt = corrected;
		}
		const zenith = 90 - alt;
		let msg = 'zenith: ';
		msg += fmtAng(90);
		msg += ' - ' + fmtAng(alt);
		msg += ' = ' + fmtAng(zenith);
		ctx.log(msg);
		ctx.current.zenith = zenith;
	},
	compare: (ctx, val) => {
		const coord = parseCoord(val);
		if (coord == null) {
			throw `Invalid coordinates format "${val}"`;
		}
		ctx.current.compare = coord;
	},
};

const aliases = {
	'body': [ 'star' ],
	'ra/dec': [ 'radec' ],
	'refraction': [ 'ref' ],
	'height': [ 'dip', 'h', 'height of eye', 'eye height' ],
	'compare': [ 'cmp', 'actual' ],
	'azimuth': [ 'az' ],
};

for (const attr in aliases) {
	const array = aliases[attr];
	for (const alias of array) {
		setters[alias] = setters[attr];
	}
}

class CalculationContext {
	constructor(log) {
		this.log = log;
		this.current = {
			dt: new DateTime(),
			ghaOfAries: null,
			ref: STANDARD_REFRACTION,
			dip: null,
			body: null,
			zenith: null,
		};
		this.sights = [];
		this.results = null;
	}
	set(attr, val) {
		const setter = setters[attr.toLowerCase()];
		if (!setter) {
			throw `Unkown field "${attr}"`;
		}
		if (val) setter(this, val);
		return this;
	}
	run(line) {
		const i = line.indexOf(':');
		if (i === -1) {
			throw `Invalid input line "${line}"`;
		}
		const [, attr, val ] = line.match(/^(.*?)\s*:\s*(.*)$/);
		this.set(attr, val);
		return this;
	}
	completeCurrentSight() {
		const { current } = this;
		const { ghaOfAries, body, zenith, azimuth } = current;
		const { names: [ name ], ra, dec } = body;
		if (ra == null || dec == null) {
			throw `Please provide the ra/dec for ${name}`;
		}
		const sha = 360 - ra;
		const gha = (ghaOfAries + sha)%360;
		const lat = dec;
		const lon = (360 - gha + 180)%360 - 180;
		this.log(`SHA of ${name} = ${fmtAng(sha)}`);
		this.log(`GHA of ${name} = ${fmtAng(gha)}`);
		this.log(`GP = ${fmtLat(lat)}, ${fmtLon(lon)}`);
		const gp = [ lat, lon ].map(toRadians);
		this.sights.push({
			gp,
			arc: zenith != null ? toRadians(zenith) : null,
			az: azimuth != null ? toRadians(azimuth) : null,
		});
		current.body = null;
		current.zenith = null;
		current.azimuth = null;
		return this;
	}
	finish() {
		const { current } = this;
		if (current.body) {
			this.completeCurrentSight();
		}
		let results = null;
		if (this.sights.find(sight => sight.az != null)) {
			results = azimuthAltSearch(this.sights);
		} else {
			results = trilaterate(this.sights.map(({ gp, arc }) => [ ...gp, arc ]));
		}
		this.results = results;
		this.log('');
		const { compare } = current;
		for (let i=0; i<results.length; ++i) {
			let label = 'result';
			if (results.length > 1) {
				label = i + 1 + 'º ' + label;
			}
			const result = results[i];
			const [ lat, lon ] = result.map(toDegrees);
			const coord = `${fmtLat(lat)}, ${fmtLon(lon)}`;
			if (compare) {
				const dist = calcDist(compare, result);
				const mi = (dist*3958.8).toPrecision(2)*1;
				this.log(`${label} = ${coord} (${mi} mi off)`);
			} else {
				this.log(`${label} = ${coord}`);
			}
		}
		return this;
	}
}

export default CalculationContext;
