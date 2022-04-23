const D90  = Math.PI/2;
const D180 = Math.PI;
const D360 = Math.PI*2;

const calcDistance = (a, b) => {
	const latDif = b.lat - a.lat;
	const longDif = b.long - a.long;
	return Math.sqrt(latDif*latDif + longDif*longDif);
};

const arrayRemove = (array, item) => array
	.splice(array.indexOf(item), 1);

const fixTarget = (target) => {
	let { lat, long } = target;
	if (lat > D90) {
		lat = D90 - (lat - D90);
		long += D180;
	} else if (lat < - D90) {
		lat = - D90 + (- lat - D90);
		long += D180;
	}
	if (long < - D180 || long > D180) {
		long = (long%D360 + D360 + D180)%D360 - D180;
	}
	target.lat = lat;
	target.long = long;
	return target;
};

class ClusteredSearchContext {
	constructor({ calcError, maxClusters = 6, shrinkFactor = 0.75, iterations = 75 }) {
		this.range = null;
		this.clusters = [];
		this.pairs = [];
		this.calcError = calcError;
		this.maxClusters = maxClusters;
		this.shrinkFactor = shrinkFactor;
		this.iterations = iterations;
	}
	addTarget(target) {
		const { clusters, pairs, maxClusters } = this;

		// Add distance pairs
		for (let cluster of clusters) {
			const dist = calcDistance(cluster, target);
			pairs.push({ a: cluster, b: target, dist });
		}

		// Adds target
		clusters.push(target);

		// No need to reduce cluster size
		if (clusters.length <= maxClusters) {
			return;
		}

		// Finds pair with minimum distance
		let index = -1;
		let dist = Infinity;
		for (let i=0; i<pairs.length; ++i) {
			const pair = pairs[i];
			if (pair.dist < dist) {
				index = i;
				dist = pair.dist;
			}
		}

		// Selects element to be removed
		const { a, b } = pairs[index];
		const remove = a.error > b.error ? a : b;

		// Removes element and pairs
		arrayRemove(clusters, remove);
		this.pairs = pairs.filter(({ a, b }) => a !== remove && b !== remove);
	}
	addNeighbors(target) {
		const { range } = this;
		const { lat: lat0, long: long0 } = target;
		for (let i=-0.25; i<=0.25; i+=0.25) {
			const lat = i*range + lat0;
			for (let j=-0.25; j<=0.25; j+=0.25) {
				const long = j*range + long0;
				const error = this.calcError([ lat, long ]);
				this.addTarget(fixTarget({ lat, long, error }));
			}
		}
	}
	iterate() {
		const { clusters } = this;
		for (let cluster of clusters) {
			this.addNeighbors(cluster);
		}
		this.range *= this.shrinkFactor;
	}
	run() {
		this.range = D90;
		this.clusters.length = 0;
		this.pairs.length = 0;
		this.clusters.push({
			lat: 0,
			long: - D90,
			error: this.calcError([ 0, - D90 ]),
		}, {
			lat: 0,
			long: D90,
			error: this.calcError([ 0, D90 ]),
		});
		const { iterations } = this;
		for (let i=0; i<iterations; ++i) {
			this.iterate();
		}
		let [ res ] = this.clusters;
		for (let cluster of this.clusters) {
			if (cluster.error < res.error) {
				res = cluster;
			}
		}
		return [ res.lat, res.long ];
	}
}

const coordClusteredSearch = (config) => new ClusteredSearchContext(config).run();

export default coordClusteredSearch;
