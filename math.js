import { Vec3, Mat3 } from '../jslib/l-algebra-3.js';
import { normalVec3ToCoord } from '../jslib/sphere-math.js';

const { PI } = Math;

const vec = Vec3();
const mat = Mat3();
export const getCoordCircle = (lat, lon, radius, numberOfPoints = 180) => {
	const rad = Math.sin(radius);
	const z = Math.cos(radius);
	const step = PI*2/numberOfPoints;
	const points = [];
	mat.rotationX(-lat).rotateY(lon);
	for (let i=0; i<numberOfPoints; ++i) {
		const angle = step*i;
		const x = Math.cos(angle)*rad;
		const y = Math.sin(angle)*rad;
		vec.set(x, y, z).apply(mat);
		points.push(normalVec3ToCoord(vec));
	}
	return points;
};
