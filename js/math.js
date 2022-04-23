import { get2CirclesIntersections, circlesIntersect } from '../../jslib/sphere-trilateration.js';
import { calcDist, coordAzDistToPoint } from '../../jslib/sphere-math.js';

import coordClusteredSearch from './coord-clustered-search.js';

export const getCoordCircle = (lat, lon, radius, numberOfPoints = 32) => {
	const coord = [ lat, lon ];
	const res = [];
	for (let i=0; i<numberOfPoints; ++i) {
		const azimuth = i/numberOfPoints*Math.PI*2;
		const point = coordAzDistToPoint(coord, azimuth, radius);
		res.push(point);
	}
	return res;
};

export const getErrorFunction = (args) => {
	const calcError = (coord) => {
		let sum = 0;
		for (let i=args.length; i--;) {
			const { gp, arc } = args[i];
			const error = calcDist(coord, gp) - arc;
			sum += error*error;
		}
		return sum;
	};
	return calcError;
};

export const trilaterate = (args) => {
	if (args.length === 2) {
		const [ a, b ] = args;
		if (circlesIntersect(a.gp, a.arc, b.gp, b.arc)) {
			return get2CirclesIntersections(
				a.gp, a.arc,
				b.gp, b.arc,
			);
		}
	}
	const calcError = getErrorFunction(args);
	return [ coordClusteredSearch({ calcError }) ];
};
