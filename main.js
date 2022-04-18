import * as Almanac from './almanac.js';
import * as Maps from './maps.js';
import { getCoordCircle } from './math.js';
import trilaterate from '../jslib/trilaterate-sphere.js';

let inputData;
let inputDecimals;
let inputProjection;
let paper;
let canvas;
let ctx;
let useDecimals = false;
let [ currentMap ] = Maps.all;

const args = [];
let results = [];
const NM_TO_MI = 1852/1609.344;
const DEG_TO_RAD = Math.PI/180;
const RAD_TO_DEG = 180/Math.PI;

const strFloat = (val, decs = 4) => (val*1).toFixed(decs)*1 + '';
const strAngle = (val) => {
	if (useDecimals) {
		return strFloat(val, 4);
	}
	const sign = val >= 0 ? '' : '-';
	const totalSec = Math.round(Math.abs(val * 3600));
	const s = totalSec % 60;
	const totalMin = Math.round((totalSec - s)/60);
	const m = totalMin % 60;
	const h = Math.round((totalMin - m)/60);
	return sign + `${
		h
	}°${
		m.toString().padStart(2, '0')
	}'${
		s.toString().padStart(2, '0')
	}"`
};
const strLat = (val) => {
	let str = strAngle(val);
	if (useDecimals) return str;
	if (str.startsWith('-')) {
		str += 'S';
	} else {
		str += 'N';
	}
	str = str.replace(/^[+\-]\s*/, '');
	return str;
};
const strLong = (val) => {
	let str = strAngle(val);
	if (useDecimals) return str;
	if (str.startsWith('-')) {
		str += 'W';
	} else {
		str += 'E';
	}
	str = str.replace(/^[+\-]\s*/, '');
	return str;
};

const hourRegex = /^(\d+\s*h\s*\d+(\s*m(\s*\d+(\.\d+)?(\s*s)?)?)?)$/i;
const degreeRegexes = [
	/^([+\-]\s*)?\d+(\s+\d+(\.\d+)?)?$/,
	/^(([+\-]\s*)?\d+(\s+\d+(\s+\d+(\.\d+)?)?)?)$/,
	/^(([+\-]\s*)?\d+(\s*°\s*\d+(\s*'\s*\d+(\.\d+)?"?)?)?)$/,
];
const floatRegex = /^(([+\-]\s*)?\d+(\.\d+)?)$/;

const parseHours = (str) => str
	.replace(/\s*([hms:])\s*/ig, '$1')
	.split(/[hms:\s]/)
	.map((val, i) => val*Math.pow(60, -i))
	.reduce((a, b) => a + b);

const parseDegrees = (str) => {
	const sign = str.startsWith('-') ? -1 : 1;
	const abs = str
		.replace(/^[+\-]\s*/, '')
		.replace(/\s*([°'"+\-])\s*/ig, '$1')
		.split(/[°'"\s]/)
		.map((val, i) => val*Math.pow(60, -i))
		.reduce((a, b) => a + b);
	return abs*sign;
};

const example = `

	Star: Antares
	Time: 2022-01-15 00:57:38 GMT-4
	ALT: 50.8687

	Star: Vega
	Time: 2022-01-15 01:13:20 -4:00
	ALT: 58 15.6

`.trim().replace(/[\t\x20]*\n[\t\x20]*/g, '\n');

const clearPaper = () => {
	paper.innerHTML = '';
};

const addPaperLine = (line) => {
	paper.innerText += line.toUpperCase();
	paper.innerHTML += '<br>';
};

const timeRegex = /^(\d+-\d+-\d+\s+\d+:\d+(:\d+(\.\d+)?)?(\s+(UTC|GMT)?\s*[\-+]\d+(:\d+)?)?)$/i;
const parseTime = str => {
	str = str.trim();
	const sign = str.startsWith('-') ? -1 : 1;
	str = str.replace(/^[+\-]/, '');
	return sign*(
		str
			.trim()
			.split(/\s*:\s*/)
			.map((val, i) => val*Math.pow(60, -i))
			.reduce((a, b) => a + b)
	);
};
const parseDateTime = (str) => {
	str = str.trim().replace(/\s+/, '\x20');
	if (!timeRegex.test(str)) {
		throw `
			Bad str format
			Check out this example:
			2022-01-22 21:32:50 +2:30
		`;
	}
	let [ date, time, zone ] = str.replace(/GMT|UTC/ig, '\x20').trim().split(/\s+/);
	let obj = new Date(`${date}T${time}Z`);
	if (isNaN(obj*1)) {
		throw 'This date/time doesn\'t seem to exist';
	}
	if (zone) {
		zone = parseTime(zone);
		const ms = zone*60*60*1000;
		obj = new Date(obj*1 - ms);
	}
	return obj;
};

const parseRa = (ra) => {
	if (!hourRegex.test(ra)) {
		throw `
			Bad right ascension format "${ra}"
			Check out the examples below:
			18h52m32.5s
			18:52
		`;
	}
	return parseHours(ra);
};

const parseDec = (dec) => {
	if (floatRegex.test(dec)) {
		return Number(dec);
	}
	if (!degreeRegexes.find(regex => regex.test(dec))) {
		throw `
			Bad declination format "${dec}"
			Check out the examples below:
			-26 28 43.2
			38°48'09.5"
			-50 24.5
			13.94217
		`;
	}
	return parseDegrees(dec);
};

const parseRaDec = (radec) => {
	if (!radec.includes('/')) {
		throw `
			Bad RA/DEC format
			Check out the examples below:
			18h52m32.5s
			-26°28'43.2"
		`;
	}
	const [ ra, dec ] = radec.trim().split(/\s*\/\s*/);
	return [
		parseRa(ra),
		parseDec(dec),
	];
};

const parseAlt = (alt) => {
	if (floatRegex.test(alt)) {
		return Number(alt);
	}
	if (!degreeRegexes.find(regex => regex.test(alt))) {
		throw `
			Bad altitude angle format "${alt}"
			Check out the examples below:
			26 28 43.2
			38°48'09.5"
			13.94217
		`;
	}
	return parseDegrees(alt);
};

const processStar = (star) => {
	let { name, radec, alt, time } = star;
	addPaperLine(`- ${name} -`);
	if (!time?.trim()) {
		throw 'Missing the time of the measurement';
	}
	time = parseDateTime(time);
	let ariesGHA = Almanac.calcAriesGHA(time);
	addPaperLine(`GHA Aries = ${strAngle(ariesGHA)}`)
	if (radec == null) {
		radec = Almanac.findRaDec(name);
		if (!radec) {
			throw `Did not find the RA/DEC for ${name} in the almanac\nPlease provide the RA/DEC manually`;
		}
	}
	let [ ra, dec ] = parseRaDec(radec);
	let lat = dec;
	let starSHA = (24 - ra)/24*360%360;
	const starGHA = (starSHA + ariesGHA)%360;
	addPaperLine(`SHA star = ${strAngle(starSHA)} // GHA star = ${strAngle(starGHA)}`);
	let long = (360 + 180 - starGHA)%360 - 180;
	addPaperLine(`GP = ${strLat(lat)}, ${strLong(long)}`);
	if (!alt) {
		throw `Missing altitude angle`;
	}
	alt = parseAlt(alt);
	let arc = 90 - alt;
	addPaperLine(`alt = ${
		strFloat(alt)
	}° // 90° - ${
		strFloat(alt)
	}° = ${
		strFloat(arc)
	}°`);
	let nms = arc*60;
	let miles = nms*NM_TO_MI;
	addPaperLine(`${
		strFloat(arc)
	}*60 nm = ${
		strFloat(nms, 1)
	} nm = ${
		strFloat(miles, 1)
	} mi`);
	addPaperLine('');
	args.push({
		gp: [ lat*DEG_TO_RAD, long*DEG_TO_RAD ],
		arc: arc*DEG_TO_RAD,
	});
};

const mountQuery = (args) => {
	let query = 'o=' + results[0].map(v => (v*RAD_TO_DEG).toFixed(3)*1).join(',');
	let count = 0;
	for (const { gp, arc } of args) {
		let name = String.fromCharCode(97 + count++);
		query += '&' + name + '=';
		query += gp.map(v => (v*RAD_TO_DEG).toFixed(3)*1).join(',');
		query += ',' + (arc*RAD_TO_DEG).toFixed(3)*1;
	}
	return query.substring(0, query.length - 1);
};

const doCalculations = () => {
	results.length = 0;
	args.length = 0;
	clearLink3D();
	let lines = inputData.value.toLowerCase().trim().split(/\s*\n\s*/);
	if (lines.length === 1 && lines[0] === '') {
		lines = [];
	}
	let current_star = null;
	let current_time = null;
	const stars = [];
	for (let line of lines) {
		const [, field, value ] = line.match(/^([^:]+?)\s*:\s*(.*)$/) ?? [];
		if (field == null || value == null) {
			throw `Unprocessable line "${line}"`;
		}
		if (field === 'star') {
			if (current_star != null) {
				processStar(current_star);
			}
			current_star = { name: value, time: current_time };
			stars.push(current_star);
			continue;
		}
		if (/ra\s*\/\s*dec/i.test(field)) {
			current_star.radec = value;
			continue;
		}
		if (field === 'time') {
			if (current_star) {
				current_star.time = value;
			}
			current_time = value;
			continue;
		}
		if (field === 'alt') {
			current_star.alt = value;
			continue;
		}
		throw `Unknown field "${field}"`;
	}
	if (current_star != null) {
		processStar(current_star);
	}
	results = trilaterate({
		points: args.map(arg => {
			const { gp, arc } = arg;
			return [ ...gp, arc ];
		}),
	});
	updateLink3D();
	for (let result of results) {
		addPaperLine(`result = ${
			strLat(result[0]*RAD_TO_DEG)
		}, ${
			strLong(result[1]*RAD_TO_DEG)
		}`);
	}
};

const clearLink3D = () => {
	const a = document.querySelector('#link_3d');
	a.setAttribute('href', '');
	a.innerHTML = '';
};

const updateLink3D = () => {
	const href = `../3d-trilateration/?${mountQuery(args)}`;
	const a = document.querySelector('#link_3d');
	a.setAttribute('href', href);
	a.innerText = '3D view';
};

const project = (lat, long) => {
	const [ nx, ny ] = currentMap.coordToNormal(lat, long);
	return [ nx*canvas.width, ny*canvas.height ];
};

const drawResult = (lat, long) => {
	const c = 2;
	const [ x, y ] = project(lat, long);
	ctx.fillStyle = '#f00';
	ctx.beginPath();
	ctx.moveTo(x + c, y);
	ctx.lineTo(x + c*2, y + c);
	ctx.lineTo(x + c*4, y + c);
	ctx.lineTo(x + c*4, y - c);
	ctx.lineTo(x + c*2, y - c);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(x - c, y);
	ctx.lineTo(x - c*2, y + c);
	ctx.lineTo(x - c*4, y + c);
	ctx.lineTo(x - c*4, y - c);
	ctx.lineTo(x - c*2, y - c);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(x, y - c);
	ctx.lineTo(x + c, y - c*2);
	ctx.lineTo(x + c, y - c*4);
	ctx.lineTo(x - c, y - c*4);
	ctx.lineTo(x - c, y - c*2);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(x, y + c);
	ctx.lineTo(x + c, y + c*2);
	ctx.lineTo(x + c, y + c*4);
	ctx.lineTo(x - c, y + c*4);
	ctx.lineTo(x - c, y + c*2);
	ctx.closePath();
	ctx.fill();
};

const makeSpotAt = (lat, long) => {
	const [ x, y ] = project(lat, long);
	ctx.lineWidth = 2;
	ctx.fillStyle = '#000';
	ctx.strokeStyle = '#fff';
	ctx.beginPath();
	ctx.arc(x, y, 3, 0, Math.PI*2);
	ctx.fill();
	ctx.stroke();
};

const makeCircle = (lat, long, arc) => {
	const points = getCoordCircle(lat, long, arc, 128);
	ctx.beginPath();
	for (let i=0; i<points.length; ++i) {
		const [ lat, long ] = points[i];
		const [ x, y ] = project(lat, long);
		if (i === 0) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	}
	ctx.closePath();
	ctx.lineWidth = 0.5;
	ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
	ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
	ctx.lineJoin = 'round';
	ctx.fill();
	ctx.stroke();
};

const updateMap = () => currentMap.getImage().then(img => {
	const height = canvas.width/img.width*img.height;
	canvas.height = height;
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
	for (let { gp, arc } of args) {
		makeCircle(...gp, arc);
	}
	for (let { gp, arc } of args) {
		makeSpotAt(...gp);
	}
	for (let result of results) {
		drawResult(...result);
	}
});

const updateCalculations = () => {
	clearPaper();
	try {
		doCalculations();
	} catch(error) {
		if (typeof error === 'string') {
			addPaperLine(error.trim().replace(/\s*\n\s*/g, '\n'));
		} else {
			addPaperLine('Oops, there was some issue during the calculations');
			addPaperLine('But you can check the console');
			console.error(error);
		}
		return;
	}
	updateMap();
};

window.addEventListener('load', async () => {
	inputData = document.querySelector('textarea');
	inputData.value = example;
	inputData.focus();
	inputData.oninput = updateCalculations;
	inputDecimals = document.querySelector('[name="decimals"]');
	inputDecimals.onchange = () => {
		useDecimals = inputDecimals.checked;
		updateCalculations();
	};
	inputProjection = document.querySelector('#projection');
	Maps.all.forEach(map => {
		inputProjection.innerHTML += `<option value=${map.id}>${map.name}</option>`
	});
	inputProjection.oninput = () => {
		currentMap = Maps[inputProjection.value];
		updateMap();
	};
	paper = document.querySelector('#paper');
	canvas = document.querySelector('canvas');
	ctx = canvas.getContext('2d');
	updateCalculations();
});
