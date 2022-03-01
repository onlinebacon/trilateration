const ALIGN_TIME = new Date(`2022-07-01 05:22:59.9 +0`);
const SID_DAY = 86164.09053820801;
const MS_TO_DEGREE = 360/1000/SID_DAY;
const HOUR_TO_DEGREE = 360/24;

const nameToId = (string) => string
	.toLowerCase()
	.replace(/[^a-zA-Z]/g, '');

const stars = `

	Acamar: 2h59m05.51s/-40°12'44.1"
	Achernar: 1h38m32.15s/-57°07'08.9"
	Acrux: 12h27m50.41s/-63°13'36.6"
	Adhara: 6h59m28.48s/-29°00'07.9"
	Al Na'ir: 22h09m39.06s/-46°50'57.5"
	Aldebaran: 4h37m10.75s/+16°33'11.3"
	Alioth: 12h55m00.86s/+55°50'38.8"
	Alkaid: 13h48m25.95s/+49°12'22.5"
	Alnilam: 5h37m19.32s/-1°11'15.1"
	Alphard: 9h28m39.82s/-8°45'19.2"
	Alphecca: 15h35m39.01s/+26°38'30.4"
	Alpheratz: 0h09m32.53s/+29°12'38.9"
	Altair: 19h51m53.39s/+8°55'38.5"
	Ankaa: 0h27m23.14s/-42°10'53.3"
	Antares: 16h30m47.76s/-26°28'54.6"
	Arcturus: 14h16m41.50s/+19°04'01.8"
	Atria: 16h51m05.47s/-69°04'07.7"
	Avior: 8h22m55.39s/-59°34'57.1"
	Bellatrix: 5h26m18.25s/+6°22'11.0"
	Betelgeuse: 5h56m21.30s/+7°24'40.1"
	Canopus: 6h24m24.51s/-52°42'24.0"
	Capella: 5h18m18.45s/+46°01'06.4"
	Deneb: 20h42m12.85s/45°21'27.8"
	Denebola: 11h50m11.41s/+14°26'57.6"
	Diphda: 0h44m42.24s/-17°51'44.9"
	Dubhe: 11h05m04.62s/+61°38'12.1"
	Elnath: 5h27m40.50s/+28°37'30.0"
	Eltanin: 17h57m09.56s/+51°29'11.6"
	Enif: 21h45m17.58s/+9°58'36.1"
	Fomalhaut: 22h58m53.32s/-29°30'05.9"
	Gacrux: 12h32m23.82s/-57°14'32.1"
	Gienah: 12h16m57.09s/-17°40'00.7"
	Hadar: 14h05m25.31s/-60°29'02.4"
	Hamal: 2h08m25.18s/+23°33'58.1"
	Kaus Australis: 18h25m40.44s/-34°22'23.1"
	Kochab: 14h50m43.52s/+74°04'04.3"
	Markab: 23h05m52.65s/+15°19'26.8"
	Menkar: 3h03m25.88s/+4°10'36.6"
	Menkent: 14h08m00.27s/-36°28'53.4"
	Miaplacidus: 9h13m22.24s/-69°48'43.9"
	Mirfak: 3h25m53.70s/+49°56'12.3"
	Nunki: 18h56m40.14s/-26°16'04.9"
	Peacock: 20h27m26.21s/-56°39'37.4"
	Polaris: 2h58m45.93s/+89°21'13.5"
	Pollux: 7h46m39.08s/+27°58'20.5"
	Procyon: 7h40m26.62s/+5°10'05.0"
	Rasalhague: 17h35m59.41s/+12°32'40.4"
	Regulus: 10h09m32.52s/+11°51'35.7"
	Rigel: 5h15m35.24s/-8°10'31.6"
	Rigil Kent.: 14h41m12.78s/-60°54'49.8"
	Sabik: 17h11m40.60s/-15°45'08.8"
	Scheat: 23h04m51.75s/+28°12'05.4"
	Schedar: 0h41m46.44s/+56°39'18.0"
	Shedar: 0h41m46.44s/+56°39'18.0"
	Shaula: 17h35m08.90s/-37°07'11.6"
	Sirius: 6h46m06.19s/-16°44'48.8"
	Spica: 13h26m22.34s/-11°16'41.1"
	Suhail: 9h08m47.25s/-43°31'27.7"
	Vega: 18h37m43.03s/+38°48'16.8"
	Zuben'ubi: 15h05m23.46s/-25°22'14.3"

`.trim().split(/\s*\n\s*/).map(star => {
	const [ name, radec ] = star.split(/\s*:\s*/);
	const id = nameToId(name);
	return { name, id, radec };
});

export const calcAriesGHA = (time) => {
	const angle = (time - ALIGN_TIME)*MS_TO_DEGREE;
	return (angle%360 + 360)%360;
};

export const findRaDec = (name) => {
	const id = nameToId(name);
	return stars.find(star => star.id === id)?.radec ?? null;
};
