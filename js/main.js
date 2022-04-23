import * as Maps from './maps.js';
import * as FormatAngles from './format-angle.js';
import { getCoordCircle } from './math.js';
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
const NM_TO_MI = 1852/1609.344;
const DEG_TO_RAD = Math.PI/180;
const RAD_TO_DEG = 180/Math.PI;

const example = `

	date: March 28, 2022
	zone: -5
	ref: standard
	height: 1 ft

	star: procyon
	time: 00:19:51
	alt: 25.2

	star: polaris
	time: 00:21:45
	alt: 45.6

	star: arcturus
	time: 00:22:33
	alt: 45.7

`.trim().replace(/[\t\x20]*\n[\t\x20]*/g, '\n');

const clearPaper = () => {
	paper.innerHTML = '';
};

const addPaperLine = (line) => {
	paper.innerText += line;
	paper.innerHTML += '<br>';
};

const mountQuery = (args) => {
	let query = 'o=' + results[0].map(v => (v*RAD_TO_DEG).toFixed(5)*1).join(',');
	let count = 0;
	for (const { gp, arc } of args) {
		let name = String.fromCharCode(97 + count++);
		query += '&' + name + '=';
		query += gp.map(v => (v*RAD_TO_DEG).toFixed(5)*1).join(',');
		query += ',' + (arc*RAD_TO_DEG).toFixed(5)*1;
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
