importScripts('CrossCorrelation.js')

onmessage = function(event) {
	
	var signalArray = new Float32Array(event.data.signalBuffer);
	var waveformArray;
	if (typeof event.data.waveformOffset != 'undefined' && typeof event.data.waveformLength != 'undefined') {
		waveformArray = new Float32Array(event.data.waveformBuffer, event.data.waveformOffset, event.data.waveformLength);
	} else {
		waveformArray = new Float32Array(event.data.waveformBuffer);
	}
	
	var result = findMaximumCorrelation(signalArray, waveformArray);
	
	postMessage(result);
	
};