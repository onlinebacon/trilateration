import { sphereSearch } from '../../jslib/sphere-search.js';
import { calcDist, calcAzimuth } from '../../jslib/sphere-math.js';

export const getErrorFunction = (sights) => {
    const zeniths = [];
    const azimuths = [];
    for (const { gp, arc, az } of sights) {
        if (arc != null) {
            zeniths.push({ gp, value: arc });
        }
        if (az != null) {
            azimuths.push({ gp, value: az });
        }
    }
    const calcError = (coord) => {
        let sum = 0;
        for (const { gp, value } of zeniths) {
            const dif = calcDist(coord, gp) - value;
            sum += dif*dif;
        }
        for (const { gp, value } of azimuths) {
            const azimuth = calcAzimuth(coord, gp);
            const dif = (azimuth - value);
            sum += dif*dif;
        }
        return sum;
    };
    return calcError;
};

export const azimuthAltSearch = (sights) => {
    const calcError = getErrorFunction(sights);
    let nInfo = 0;
    for (const { arc, az } of sights) {
        nInfo += arc != null;
        nInfo += az != null;
    }
    const nResults = nInfo > 2 ? 1 : 2;
    return sphereSearch({ calcError, nResults });
};
