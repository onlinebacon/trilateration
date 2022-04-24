import { coordAzDistToPoint } from '../../jslib/sphere-math.js';

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
