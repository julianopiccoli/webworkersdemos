function findMaximumCorrelation(signalArray, waveformArray) {
	
	var end = waveformArray.length - signalArray.length;
	var maximumCorrelation = -Infinity;
	var maximumCorrelationPosition = -1;
	for (var displacement = 0; displacement < end; displacement++) {
		var currentCorrelation = 0;
		for (var index = 0; index < signalArray.length; index++) {
			currentCorrelation += signalArray[index] * waveformArray[displacement + index];
		}
		if (currentCorrelation > maximumCorrelation) {
			maximumCorrelation = currentCorrelation;
			maximumCorrelationPosition = displacement;
		}
	}
	
	return {
		maximumCorrelationValue: maximumCorrelation,
		maximumCorrelationPosition: maximumCorrelationPosition
	};
	
}