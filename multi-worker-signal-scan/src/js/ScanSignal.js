/*
 *	Some browsers support the ArrayBuffer.prototype.slice function, but
*	not the TypedArray.prototype.slice. In these cases, we provide an
*	implementation for the latter function using the built-in
*	ArraBuffer.prototype.slice.
 */
if (typeof Float32Array.prototype.slice == 'undefined') {
	Float32Array.prototype.slice = function(start, end) {
		start = start || 0;
		end = end || this.length;
		start = start * Float32Array.BYTES_PER_ELEMENT;
		end = end * Float32Array.BYTES_PER_ELEMENT;
		if (this.byteOffset) {
			start += this.byteOffset;
			end += this.byteOffset;
		}
		return new Float32Array(this.buffer.slice(start, end));
	};
} 

/*
 *	Scans for the specified signal in the provided waveform array.
 *	The waveform may contain background noise and should contain
 *	the signal somewhere. The scan should work event if the signal
 *	present in the waveform is slightly attenuated.
 *	This implementation uses a multi-worker approach for finding
 *	the position in the waveform which presents the maximum correlation
 *	with the signal (see https://en.wikipedia.org/wiki/Cross-correlation).
 *	
 *	@param signalArray A Float32Array containing the signal.
 *	@param waveformArray A Float32Array which contains the provided signal somewhere.
 *	@param numberOfWorkers An optional positive integer number which denotes the number
 *	of parallel workers which will be used in the signal processing.
 *
 *	@return An object containing:
 *		- A Promise which resolves with the most likely position of the signal in the waveform (property 'promise');
 *		- A cancellation function which can be used to abort the calculation (property 'cancel').
 */
function scanSignal(signalArray, waveformArray, numberOfWorkers) {

	if (!numberOfWorkers || numberOfWorkers < 1) {
		numberOfWorkers = 1;
	}

	var workers = [];
	
	var sharedBuffersUsed = typeof SharedArrayBuffer == 'function'
								&& signalArray.buffer.constructor == SharedArrayBuffer
								&& waveformArray.buffer.constructor == SharedArrayBuffer;
								
	var maximumCorrelation = -Infinity;
	var maximumCorrelationPosition = -1;
	var resolveFunction;
	var rejectFunction;
	var cancelled = false;
	
	function cancel() {
		if (workers.length > 0) {
			for (index in workers) {
				workers[index].worker.terminate();
			}
			workers = [];
			cancelled = true;
			if (rejectFunction) {
				rejectFunction('Cancelled');
			}
		}
	}
								
	function findAndRemoveWorker(worker) {
		for (var index = 0; index < workers.length; index++) {
			if (workers[index].worker == worker) {
				var workerData = workers[index];
				workers.splice(index, 1);
				return workerData;
			}
		}
		return null;
	}
	
	function promiseCallback(_resolveFunction, _rejectFunction) {
		resolveFunction = _resolveFunction;
		rejectFunction = _rejectFunction;
		if (workers.length == 0) {
			if (cancelled && rejectFunction) {
				rejectFunction('Cancelled');
			} else if (!cancelled && resolveFunction) {
				resolveFunction(maximumCorrelationPosition);
			}
		}
	}
								
	function workerMessageProcessor(event) {
		var workerData = findAndRemoveWorker(event.target);
		if (workerData != null && event.data.maximumCorrelationValue > maximumCorrelation) {
			maximumCorrelation = event.data.maximumCorrelationValue;
			maximumCorrelationPosition = workerData.displacement + event.data.maximumCorrelationPosition;
		}
		if (workers.length == 0 && resolveFunction != null && !cancelled) {
			resolveFunction(maximumCorrelationPosition);
		}
	}
								
	function createWorker(displacement, workLength) {
		var worker = new Worker('js/ScanSignalWorker.js');
		workers.push({
			displacement: displacement,
			worker: worker
		});
		worker.onmessage = workerMessageProcessor;
		var workerMessage = {
			displacement: displacement
		};
		if (sharedBuffersUsed) {
			// When SharedArrayBuffers are used, there is no need to create a copy of the buffer contents
			// for each Worker. Not all browsers support this feature. Even browsers which support SharedArrayBuffer
			// usually impose constraints in its use.
			// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer.
			workerMessage.signalBuffer = signalArray.buffer;
			workerMessage.waveformBuffer = waveformArray.buffer;
			workerMessage.waveformOffset = displacement * Float32Array.BYTES_PER_ELEMENT;
			workerMessage.waveformLength = workLength + signalArray.length;
			worker.postMessage(workerMessage);
		} else {
			workerMessage.signalBuffer = signalArray.slice().buffer;
			workerMessage.waveformBuffer = waveformArray.slice(displacement, displacement + workLength + signalArray.length).buffer;
			// Specify the buffers as 'Transferables' to avoid copying them again.
			worker.postMessage(workerMessage, [workerMessage.signalBuffer, workerMessage.waveformBuffer]);
		}
	}
	
	var length = waveformArray.length - signalArray.length;
	var lengthPerWorker = Math.floor(length / numberOfWorkers);
	
	if (lengthPerWorker > 0) {
		for (var index = 0; index < numberOfWorkers - 1; index++) {
			var displacement = index * lengthPerWorker;
			createWorker(displacement, lengthPerWorker);
		}			
	}
	var lastDisplacement = (numberOfWorkers - 1) * lengthPerWorker;
	createWorker(lastDisplacement, length - lastDisplacement);
	
	return {
		promise: new Promise(promiseCallback),
		cancel: cancel
	};
	
}