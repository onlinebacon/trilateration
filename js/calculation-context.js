import * as Angles from '../../jslib/angles.js';
import * as Almanac from '../../jslib/almanac-2022.js';
import * as Corrections from '../../jslib/cel-nav-corrections.js';

import * as FormatAngle from './format-angle.js';
import { trilaterate } from './math.js';

const TO_RAD = Math.PI/180;

const months = [
	'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
	'october', 'november', 'december',
];

const dtToTimestamp = (dt) => {
	const { year, month, day, hour, min, sec = 0, timezone = '+00:00' } = dt;
	const values = [ year, month, day, hour, min, sec, timezone ];
	if (values.includes(undefined)) {
		return new Date('x');
	}
	let str = year.toString().padStart(4, '0');
	str += '-' + month.toString().padStart(2, '0');
	str += '-' + day.toString().padStart(2, '0');
	str += ' ' + hour.toString().padStart(2, '0');
	str += ':' + min.toString().padStart(2, '0');
	str += ':' + sec.toFixed(3).padStart(6, '0');
	str += timezone;
	return new Date(str);
};

const dtFormat = {
	regex: /^\d+-\d+-\d+\s+\d+:\d+:\d+(\.\d+)?\s+((UTC|GMT)\s*)?[+\-]\d+(:\d+)?$/i,
	parse: str => {
		str = str.replace(/\s+/g, '\x20');
		str = str.replace(/([+\-])\s+/, '$1');
		str = str.replace(/UTC|GMT/, '')
		let [ year, month, day, hour, min, sec ] = str.split(/[\-\s:]/).map(Number);
		let [ timezone ] = str.match(/[+\-]\d+(:\d+)?$/);
		timezone = timezone.replace(/\d+/g, d => d.padStart(2, '0'));
		if (!timezone.includes(':')) timezone += ':00';
		return { year, month, day, hour, min, sec, timezone };
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
		return { hour, min, ...(sec != null ? {sec} : {}) };
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
		day = Number(day);
		year = Number(year);
		return { day, month, year };
	},
};

const zoneFormat = {
	regex: /^(GMT|UTC|((GMT|UTC)\s*)?[+\-]\s*\d+(:\d+)?)$/i,
	parse: str => {
		if (/^(GMT|UTC)$/i.test(str)) return { timezone: '+00:00' };
		str = str.replace(/GMT|UTC/i, '');
		str = str.replace(/\s+/g, ' ');
		str = str.trim();
		let timezone = str[0];
		str = str.replace(/[+\-]/, '');
		let [ hour, min = 0 ] = str.split(':').map(Number);
		timezone += hour.toString().padStart(2, '0');
		timezone += ':';
		timezone += min.toString().padStart(2, '0');
		return { timezone };
	},
};

const heightFormat = {
	regex: /\d+(\.\d+)?\s*(m|ft)/i,
	parse: str => {
		let [ unit ] = str.match(/[a-z]+$/g);
		let val = Number(str.replace(/[^\d\.]/g, '').trim());
		if (unit.toLowerCase() === 'ft') val *= 0.3048;
		return val;
	},
};

const setters = {
	body: (ctx, val) => {
		const star = Almanac.lookup(val) ?? val;
		if (ctx.data.body) ctx.compileSight();
		ctx.data.body = star;
		ctx.started = true;
	},
	star: (...args) => setters.body(...args),
	time: (ctx, val) => {
		const format = [ dtFormat, timeFormat ].find(format => format.regex.test(val));
		if (!format) throw `Unkown time format "${val}"`;
		ctx.data.dt = { ...ctx.data.dt, ...format.parse(val) };
	},
	date: (ctx, val) => {
		if (!dateFormat.regex.test(val)) throw `Unkown date format "${val}"`;
		ctx.data.dt = { ...ctx.data.dt, ...dateFormat.parse(val) };
	},
	zone: (ctx, val) => {
		if (!zoneFormat.regex.test(val)) throw `Unkown zone format "${val}"`;
		ctx.data.dt = { ...ctx.data.dt, ...zoneFormat.parse(val) };
	},
	zenith: (ctx, val) => {
		const zenith = Angles.parse(val);
		if (zenith == null) throw `Invalid format for zenith angle "${val}"`;
		ctx.data.zenith = zenith;
		ctx.compileSight();
	},
	alt: (ctx, val) => {
		if (/^([+\-]\s*)?\d+(\.\d+)?$/.test(val)) {
			ctx.data.alt = Number(val);
		} else {
			const alt = Angles.parse(val);
			if (alt == null) throw `Invalid format for altitude "${val}"`;
			ctx.data.alt = alt;
		}
		ctx.compileSight();
	},
	height: (ctx, val) => {
		if (!heightFormat.regex.test(val)) throw `Invalid format for height "${val}"`;
		const height = heightFormat.parse(val);
		ctx.data.height = height;
	},
	'ra/dec': (ctx, val) => {
		const arr = val.split(/\s*\/\s*/);
		if (arr.length !== 2) throw `Invalid format for RA/DEC "${val}"`;
		let [ ra, dec ] = arr.map(Angles.parse);
		if (ra == null) throw `Invalid format for right ascension "${arr[0]}"`;
		if (dec == null) throw `Invalid format for declination "${arr[1]}"`;
		ctx.data.radec = [ ra, dec ];
	},
	ref: (ctx, val) => {
		val = val.toLowerCase();
		if (val !== 'standard' && val !== 'std') throw `Invalid format for refraction "${val}"`;
		ctx.data.refraction = 'standard';
	},
};

class CalculationContext {
	constructor(log) {
		this.started = false;
		this.data = {};
		this.sights = [];
		this.log = log;
		this.results = [];
	}
	set(attr, val) {
		const setter = setters[attr.toLowerCase()];
		if (!setter) throw `Unkown field "${attr}"`;
		if (val) setter(this, val);
	}
	compileSight() {
		const { data, log } = this;
		let { body, radec, dt, alt, height, zenith, refraction } = data;
		let name;
		if (typeof body === 'string') {
			if (!radec) throw `Unkown celestial body "${body}", please provide the RA/DEC`;
		} else {
			let { ra, dec } = body;
			name = body.names[0];
			radec = [ ra, dec ];
		}
		log?.(`- ${name} -`);
		let [ ra, dec ] = radec;
		const sha = 360 - ra;
		log?.(`SHA = ${FormatAngle.angle(sha)}, dec = ${FormatAngle.angle(dec)}`);
		const timestamp = dtToTimestamp(dt);
		if (isNaN(timestamp*1)) throw `Invalid date`;
		const ariesGHA = Almanac.getAriesGHAAt(timestamp);
		log?.(`GHA of Aries = ${FormatAngle.angle(ariesGHA)}`);
		const gha = (ariesGHA + sha)%360;
		log?.(`GHA of ${name} = ${FormatAngle.angle(gha)}`);
		let lat = dec;
		let lon = (360 + 180 - gha)%360 - 180;
		log?.(`GP = ${FormatAngle.lat(lat)}, ${FormatAngle.lon(lon)}`);
		if (alt != null) {
			if (height != null) {
				const dip = Corrections.dip(height);
				const corrected = alt - dip;
				log?.(`dip: ${
					FormatAngle.angle(alt)
				} - ${
					FormatAngle.angle(dip)
				} = ${
					FormatAngle.angle(corrected)
				}`);
				alt = corrected;
			}
			if (refraction === 'standard') {
				const dif = Corrections.refraction(alt);
				const corrected = alt - dif;
				log?.(`refraction: ${
					FormatAngle.angle(alt)
				} - ${
					FormatAngle.angle(dif)
				} = ${
					FormatAngle.angle(corrected)
				}`);
				alt = corrected;
			}
			zenith = 90 - alt;
			log?.(`zenith = 90° - ${FormatAngle.angle(alt)} = ${FormatAngle.angle(zenith)}`);
		} else if (zenith != null) {
			if (refraction === 'standard') {
				const dif = Corrections.refraction(90 - zenith);
				const corrected = zenith + dif;
				log?.(`refraction: ${
					FormatAngle.angle(zenith)
				} + ${
					FormatAngle.angle(dif)
				} = ${
					FormatAngle.angle(corrected)
				}`);
				zenith = corrected;
			}
		} else {
			throw `Missing alt/zenith for ${name}`;
		}
		this.data = { dt, height, refraction };
		this.started = false;
		this.sights.push({ gp: [ lat*TO_RAD, lon*TO_RAD ], arc: zenith*TO_RAD });
		log?.('');
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
	finish() {
		if (this.started) this.compileSight();
		const results = trilaterate(this.sights);
		this.results = results;
		for (let result of results) {
			const [ lat, lon ] = result;
			this.log(`result = ${ FormatAngle.lat(lat/TO_RAD) }, ${ FormatAngle.lon(lon/TO_RAD) }`);
		}
		return this;
	}
}

export default CalculationContext;
