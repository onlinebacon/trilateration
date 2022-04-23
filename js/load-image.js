const loadImage = src => new Promise((done, fail) => {
	const image = new Image();
	image.onload = () => done(image);
	image.onerror = error => fail(error);
	image.src = src;
});

export default loadImage;
