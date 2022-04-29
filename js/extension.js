import CalculationContext from './calculation-context.js';

const getRequest = (url) => new Promise((done, fail) => {
	const xmlhttp = new XMLHttpRequest();
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == XMLHttpRequest.DONE) {
			if (xmlhttp.status == 200) {
				done(xmlhttp.responseText);
			} else {
				fail(xmlhttp.status);
			}
		}
	};
	xmlhttp.open('GET', url, true);
	xmlhttp.send();
});

const executeFile = async (name) => {
	const content = await getRequest(`./${name}`);
	const tests = content
		.split(/(^|\n)test:\s*/)
		.map(test => test.trim())
		.filter(test => test !== '')
		.map(text => {
			const [ id ] = text.match(/^\d+/);
			text = text.replace(/^\d+\s*/, '');
			text = text.replace(/\bf\n/, 'ft\n');
			text = text.replace(/index:\s([^\s]*)/, `index: $1'`);
			const ctx = new CalculationContext(() => {});
			const lines = text.trim().split(/\s*\n\s*/);
			try {
				lines.forEach(line => ctx.run(line));
				ctx.finish();
			} catch(error) {
				if (typeof error !== 'string' || !error.includes('ra/dec')) {
					throw error;
				}
			}
			const { error } = ctx;
			return { id, error, text };
		})
		.filter(res => res.error != null)
		.sort((a, b) => b.error - a.error);

	console.log(tests[0].text);
	
	const log = tests.map(({ id, error }) => `#${id}: ${error} miles off`).join('\n');
	console.log(log);
};

executeFile('./celest-test-50.txt');
