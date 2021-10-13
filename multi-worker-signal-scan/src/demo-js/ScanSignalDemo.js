// Olders browsers (like IE11 for instance) do not support the Promise interface.
// The function below mimics the basic functionality of a Promise. It is definitely
// not a complete polyfill, but is enough for the demo. There are good polyfills for
// Promise out there if you need so.
if (typeof Promise == 'undefined') {
	function Promise(promiseCallback) {
		this.then = function(resolveCallback, rejectCallback) {
			promiseCallback(resolveCallback, rejectCallback);
		};
	}
}

var currentTask;

// Some browsers expose the number of processing cores the system provides in the
// 'navigator.hardwareConcurrency' property. If present, this value is loaded into
// the 'number-of-workers' input field. Otherwise, value '2' is loaded.
function loadDefaultNumberOfWorkers() {
	var numberOfWorkersInput = document.getElementById('number-of-workers');
	if (typeof navigator.hardwareConcurrency == 'number') {
		numberOfWorkersInput.value = '' + navigator.hardwareConcurrency;
	} else {
		numberOfWorkersInput.value = '2';
	}
}

function replaceCommaWithDots(text) {
	return text.replace(',', '.');
}

function loadParameters() {
	
	var positiveSignalLengthInput = document.getElementById('positive-interval-length');
	var positiveSignalValueInput = document.getElementById('positive-interval-value');
	var negativeSignalLengthInput = document.getElementById('negative-interval-length');
	var negativeSignalValueInput = document.getElementById('negative-interval-value');
	
	var waveformLengthInput = document.getElementById('waveform-length');
	var noiseAmplitudeInput = document.getElementById('noise-amplitude');
	var signalGainInput = document.getElementById('signal-gain');
	
	var numberOfWorkersInput = document.getElementById('number-of-workers');
	
	return {
		positiveSignalLength: parseInt(positiveSignalLengthInput.value) || 300,
		positiveSignalValue: parseFloat(replaceCommaWithDots(positiveSignalValueInput.value)) || 20.0,
		negativeSignalLength: parseInt(negativeSignalLengthInput.value) || 200,
		negativeSignalValue: parseFloat(replaceCommaWithDots(negativeSignalValueInput.value)) || 10.0,
		waveformLength: parseInt(waveformLengthInput.value) || 100000000,
		noiseAmplitude: parseFloat(replaceCommaWithDots(noiseAmplitudeInput.value)) || 30.0,
		signalGain: parseFloat(replaceCommaWithDots(signalGainInput.value)) || 0.7,
		numberOfWorkers: parseInt(numberOfWorkersInput.value) || 8
	};
	
}

function cleanOutputArea() {
	var outputArea = document.getElementById('output-area');
	outputArea.value = '';
}

function appendTextToOutputArea(text) {
	var outputArea = document.getElementById('output-area');
	outputArea.value += text + '\n';
}

function startTest() {
	
	if (currentTask) {
		currentTask.cancel();
	} 
	
	var parameters = loadParameters();
	cleanOutputArea();
	appendTextToOutputArea('Preparing data');
	
	var signalArray;
	var waveformArray;
	// Trying to use SharedArrayBuffer if possible. This avoids the signal scanner to create copies of the buffer data for each worker.
	if (typeof SharedArrayBuffer != 'undefined') {
		appendTextToOutputArea('>> SharedArrayBuffer available!');
		var signalArrayBuffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * (parameters.positiveSignalLength + parameters.negativeSignalLength));
		var waveformArrayBuffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * parameters.waveformLength);
		signalArray = new Float32Array(signalArrayBuffer);
		waveformArray = new Float32Array(waveformArrayBuffer);
	} else {
		appendTextToOutputArea('>> SharedArrayBuffer unavailable. Memory usage and initialization time may be impacted.');
		signalArray = new Float32Array(parameters.positiveSignalLength + parameters.negativeSignalLength);
		waveformArray = new Float32Array(parameters.waveformLength);
	}
	
	// Building the signal.
	for (var index = 0; index < parameters.positiveSignalLength; index++) {
		signalArray[index] = parameters.positiveSignalValue;
	}
	for (var index = parameters.positiveSignalLength; index < signalArray.length; index++) {
		signalArray[index] = parameters.negativeSignalValue;
	}
	
	// Filling the waveform with random noise.
	for (var index = 0; index < waveformArray.length; index++) {
		waveformArray[index] = (Math.random() - 0.5) * 2 * parameters.noiseAmplitude;
	}
	
	var maxSignalPosition = waveformArray.length - signalArray.length;
	var signalPosition = Math.floor(Math.random() * maxSignalPosition);
	
	appendTextToOutputArea('Actual signal position: ' + signalPosition);
	
	// Adding a possibly attenuated version of the signal to a random position in the waveform.
	for (var index = 0; index < signalArray.length; index++) {
		waveformArray[index + signalPosition] += signalArray[index] * parameters.signalGain;
	}
	
	var startTimestamp = new Date().getTime();
	
	appendTextToOutputArea('Starting');
	// Start the scan process.
	var task = scanSignal(signalArray, waveformArray, parameters.numberOfWorkers);
	currentTask = task;
	appendTextToOutputArea('Workers started. Waiting for results...');
	task.promise.then(function(result) {
		if (task == currentTask) {	// Scan terminated successfully.
			var totalTime = new Date().getTime() - startTimestamp;
			appendTextToOutputArea('Result: ' + result);
			appendTextToOutputArea('Distance from actual position: ' + (Math.abs(signalPosition - result)));
			appendTextToOutputArea('Total time spent in ms: ' + totalTime);
		}
	}, function(rejectionReason) {
		if (task == currentTask) {	// Scan rejected.
			appendTextToOutputArea('Task rejected: ' + rejectionReason);
		}
	});
	
	var initTime = new Date().getTime() - startTimestamp;
	appendTextToOutputArea('Init time in ms: ' + initTime);
	
}

function cancelTest() {
	if (currentTask) {
		currentTask.cancel();
	}
}