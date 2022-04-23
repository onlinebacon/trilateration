import loadImage from './load-image.js';

const { PI, sin, cos, tan, log } = Math;
const TAU = PI*2;

const equirectangularImgPromise = loadImage('img/equirectangular.png');
export const equirectangular = {
	id: 'equirectangular',
	name: 'Equirectangular',
	getImage: () => equirectangularImgPromise,
	coordToNormal: (lat, long) => [
		0.5 + long/TAU,
		0.5 - lat/PI,
	],
};

const azimuthalImgPromise = loadImage('img/azimuthal.png');
export const azimuthal = {
	id: 'azimuthal',
	name: 'Azimuthal Equidistant',
	getImage: () => azimuthalImgPromise,
	coordToNormal: (lat, long) => {
		const rad = 0.25 - lat/TAU;
		return [
			0.5 + sin(long)*rad,
			0.5 + cos(long)*rad,
		];
	},
};

const mercatorImgPromise = loadImage('img/mercator.png');
export const mercator = {
	id: 'mercator',
	name: 'Mercator',
	getImage: () => mercatorImgPromise,
	coordToNormal: (lat, long) => [
		0.5 + long/TAU,
		0.5 - log(tan(PI/4 + lat/2))/TAU,
	],
};

const gallPetersImgPromise = loadImage('img/gallpeters.png');
export const gallPeters = {
	id: 'gallPeters',
	name: 'Gall-Peters',
	getImage: () => gallPetersImgPromise,
	coordToNormal: (lat, long) => [
		0.5 + long/TAU,
		0.5 - sin(lat)/2,
	],
};

export const all = [
	equirectangular,
	mercator,
	gallPeters,
	azimuthal,
];
