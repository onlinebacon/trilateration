const filter = str => str.toLowerCase().replace(/[^a-z]/g, '');
let zenith = false;
const starNames = `

	acamar
	achernar
	acrux
	adhara
	al na'ir
	aldebaran
	alioth
	alkaid
	alnilam
	alphard
	alphecca
	alpheratz
	altair
	ankaa
	antares
	arcturus
	atria
	avior
	bellatrix
	betelgeuse
	canopus
	capella
	deneb
	denebola
	diphda
	dubhe
	elnath
	eltanin
	enif
	fomalhaut
	gacrux
	gienah
	hadar
	hamal
	kaus australis
	kochab
	markab
	menkar
	menkent
	miaplacidus
	mirfak
	nunki
	peacock
	polaris
	pollux
	procyon
	rasalhague
	regulus
	rigel
	rigil kent.
	sabik
	scheat
	schedar
	shedar
	shaula
	sirius
	spica
	suhail
	vega
	zuben'ubi

`.trim().split(/\s+/).map(filter);

const closestStar = (line) => {
	const filtered = filter(line);
	return starNames.find(name => name.startsWith(filtered));
};

let stopped = false;
const css = (doc, style) => {
	for (let attr in style) {
		doc.style[attr] = style[attr];
	}
	return doc;
};

const create = (tagname, style = {}) => {
	const doc = document.createElement(tagname);
	return css(doc, style);
};

const div = create('div', {
	position: 'fixed',
	top: '20px',
	right: '20px',
	width: '430px',
	padding: '15px 10px',
	'border-radius': '5px',
	'background-color': 'rgba(255, 255, 255, 0.65)',
	'box-shadow': '-5px -5px 20px rgba(0, 0, 0, 0.5)',
});

for (let name of starNames) {
	const star = create('div', {
		'font-size': '12px',
		display: 'inline-block',
		'background-color': '#fff',
		margin: '2px',
		padding: '0px 2px',
		cursor: 'pointer',
	});
	star.innerText = name;
	div.appendChild(star);
}

div.appendChild(create('br'));

const textarea = create('textarea', {
	'margin-top': '10px',
	height: '600px',
});
const form = create('form');
form.setAttribute('spellcheck', 'false');
form.appendChild(textarea);
div.appendChild(form);
document.body.appendChild(div);
textarea.onblur = () => !stopped && textarea.focus();
textarea.focus();
const translateStar = (line) => {
	return 'star: ' + closestStar(line);
};
let defs = {};
const resetDefs = () => {
	defs = {
		y: '2022',
		mo: '01',
		d: '01',
		h: '00',
		m: '00',
		s: '00',
		zh: '-05',
		zm: '00',
	};
};
resetDefs();
const translateTime = (line) => {
	let [
		s = defs.s,
		m = defs.m,
		h = defs.h,
		d = defs.d,
		mo = defs.mo,
		y = defs.y,
		zh = defs.zh,
		zm = defs.zm,
	] = line.trim().split(/\s+/);
	d = d.padStart(2, '0');
	mo = mo.padStart(2, '0');
	h = h.padStart(2, '0');
	m = m.padStart(2, '0');
	s = s.padStart(2, '0');
	if (zh) {
		const [ sign = '+' ] = zh.match(/[\-\+]/) ?? [];
		zh = zh.replace(/[\-\+]/g, '')
		zh = sign + (zh + '').padStart(2, '0');
	}
	if (zm) {
		zm = (zm + '').padStart(2, '0');
	}
	defs = { y, mo, d, h, m, s, zh, zm };
	return `Time: ${y}-${mo}-${d} ${h}:${m}:${s} GMT${zh}:${zm}`;
};
const translateAlt = (line) => {
	line = line.trim()
	if (!zenith) {
		return `Alt: ${line}`;
	}
	const [ sign = '+' ] = line.match(/[\-\+]/) ?? [];
	line = line.replace(/[\-\+]/g, '')
	let val = line.split(/\s+/).map((x, i) => x*Math.pow(60, -i));
	val = 90 - Number(sign + val);
	return `Alt: ${val}`;
};
const target = document.querySelector('textarea');
const translate = () => {
	resetDefs();
	const lines = textarea.value.trim().split(/\s*\n\s*/);
	if (lines[0] === 'z') {
		lines.splice(0, 1);
		zenith = true;
	} else {
		zenith = false;
	}
	let text = '';
	for (let i=0; i<lines.length; ++i) {
		const line = lines[i];
		const type = i % 3;
		switch (type) {
			case 0: text += translateStar(line); break;
			case 1: text += translateTime(line); break;
			case 2: text += translateAlt(line); break;
		}
		text += '\n';
		if (type === 2) text += '\n';
	}
	target.value = text;
	window.updateCalculations();
};
textarea.oninput = () => !stopped && translate();
window.addEventListener('keydown', e => {
	const key = e.key.toLowerCase();
	if (key === 'enter' && e.ctrlKey) {
		stopped = true;
		window.onResult = (res) => {
			textarea.value = res;
			textarea.select();
		};
		window.updateCalculations();
	}
});
