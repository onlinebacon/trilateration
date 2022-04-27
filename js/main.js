import { coordAzDistToPoint } from '../../jslib/sphere-math.js';

import * as Maps from './maps.js';
import * as FormatAngles from './format-angle.js';
import CalculationContext from './calculation-context.js';

let inputData;
let inputDecimals;
let inputProjection;
let paper;
let canvas;
let ctx;
let [ currentMap ] = Maps.all;

const args = [];
let results = [];
const toDegrees = (rad) => rad*(180/Math.PI);

const example = `

	date: April 24th, 2022
	zone: GMT-5
	height: 5 ft
	index: -1
	refraction: standard
	compare: 44.830553, -93.060625
	
	star: Arcturus
	time: 22:40:03
	alt: 49° 42.6'
	
	star: Regulus
	time: 22:23:39
	alt: 54° 27.1'

`.trim().replace(/[\t\x20]*\n[\t\x20]*/g, '\n');

const clearPaper = () => {
	paper.innerHTML = '';
};

const addPaperLine = (line) => {
	if (line !== '' || paper.innerHTML !== '') {
		paper.innerText += line;
		paper.innerHTML += '<br>';
	}
};

const mountQuery = (args) => {
	let query = 'o=' + results[0].map(v => toDegrees(v).toFixed(5)*1).join(',');
	let count = 0;
	for (const { gp, arc } of args) {
		let name = String.fromCharCode(97 + count++);
		query += '&' + name + '=';
		query += gp.map(v => toDegrees(v).toFixed(5)*1).join(',');
		query += ',' + toDegrees(arc).toFixed(5)*1;
	}
	return query.substring(0, query.length - 1);
};

const doCalculations = () => {
	clearLink3D();
	let lines = inputData.value.trim().split(/\s*\n\s*/);
	if (lines.length === 1 && lines[0] === '') {
		lines = [];
	}
	const context = new CalculationContext(addPaperLine);
	for (let line of lines) {
		context.run(line);
	}
	context.finish();
	results = context.results;
	args.length = 0;
	args.push(...context.sights);
	updateLink3D();
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

const MIN_DIST = 10;

class CircleNode {
	constructor(center, azimuth, radius) {
		const [ lat, lon ] = coordAzDistToPoint(center, azimuth, radius);
		this.center = center;
		this.azimuth = azimuth;
		this.radius = radius;
		this.view = project(lat, lon);
		this.next = this;
		this.prev = this;
	}
	addRight(node) {
		const { next } = this;
		this.next = node;
		next.prev = node;
		node.prev = this;
		node.next = next;
		return this;
	}
	distTo(node) {
		const [ ax, ay ] = this.view;
		const [ bx, by ] = node.view;
		const dx = bx - ax;
		const dy = by - ay;
		return Math.sqrt(dx*dx + dy*dy);
	}
	expandRight(maxCalls = 10) {
		if (maxCalls === 0) return this;
		if (this.distTo(this.next) <= MIN_DIST) return this;
		const { center, radius, next } = this;
		const a = this.azimuth;
		const b = next.azimuth;
		const azimuth = (a + b)*0.5;
		const node = new CircleNode(center, azimuth, radius);
		this.addRight(node);
		node.expandRight(maxCalls - 1);
		this.expandRight(maxCalls - 1);
		return this;
	}
}

const generateList = (lat, lon, arc) => {
	const center = [ lat, lon ];
	const a = new CircleNode(center, 0, arc);
	const b = new CircleNode(center, Math.PI, arc);
	const c = new CircleNode(center, Math.PI*2, arc);
	a.addRight(b);
	b.addRight(c);
	a.expandRight();
	b.expandRight();
	return a;
};

const splitIfBreaks = (head) => {
	const max = Math.min(canvas.width, canvas.height)*0.5;
	let node = head;
	for (;;) {
		const { next } = node;
		if (next === null) {
			break;
		}
		const dist = node.distTo(next);
		if (dist >= max) {
			next.prev = null;
			node.next = null;
			return next;
		}
		node = node.next;
		if (node === null || node === head) {
			break;
		}
	}
	return null;
};

const drawList = (head) => {
	let node = head;
	ctx.beginPath();
	ctx.lineWidth = 1.5;
	ctx.lineJoin = 'round';
	for (;;) {
		const [ x, y ] = node.view;
		if (node === head) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
		node = node.next;
		if (node === head || node === null) {
			break;
		}
	}
	if (node !== null) {
		ctx.closePath();
	}
	ctx.stroke();
}

const drawCircle = (lat, lon, arc) => {
	const head = generateList(lat, lon, arc);
	let next = splitIfBreaks(head);
	if (next === null) {
		drawList(head);
	} else {
		while (next !== null) {
			let list = splitIfBreaks(next);
			drawList(next);
			next = list;
		}
	}
};

const updateMap = () => currentMap.getImage().then(img => {
	const height = canvas.width/img.width*img.height;
	canvas.height = height;
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
	for (let { gp, arc } of args) {
		drawCircle(...gp, arc);
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
		FormatAngles.useDecimals(inputDecimals.checked);
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
