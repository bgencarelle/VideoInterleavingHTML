// js/indexController.js
import { FRAME_DURATION } from './config.js';
import { PINGPONG_MODE } from './config.js';

export class IndexController {
    constructor(fps = 60) { // Added default fps parameter
        this.frameNumber = 0; // Single frame number
        this.cycleLength = 0; // Total frames in a full cycle (forward + backward) if PingPong mode

        // Listeners for frame changes
        this.listeners = [];

        // FPS calculation for frame changes
        this.frameTimes = []; // Stores elapsed times for FPS calculation
        this.lastLoggedIPS = -1; // To avoid redundant logs
        this.lastFrameChangeTime = performance.now(); // Initialize with current timestamp

        // Time-based indexing
        this.frameDuration = FRAME_DURATION; // Duration per frame in milliseconds
        this.startTime = performance.now(); // Reference start time

        // Added fps property
        this.fps = fps;
    }

    /**
     * Initializes the IndexController with the maximum index.
     * Calculates cycle length based on PingPong mode.
     * @param {number} maxIndex - The maximum index value.
     */
    initialize(maxIndex) {
        this.cycleLength = PINGPONG_MODE ? maxIndex * 2 : maxIndex;
        console.log(`IndexController initialized with cycleLength: ${this.cycleLength}`);
    }

    /**
     * Updates the current frame number based on the current timestamp.
     * @param {number} currentTimestamp - The current timestamp in milliseconds.
     */
    update(currentTimestamp) {
        const elapsedTime = currentTimestamp - this.startTime;
        const totalFrames = Math.floor(elapsedTime / this.frameDuration)


        // Calculate frameNumber based on PingPong mode
        const frameNumber = PINGPONG_MODE
            ? totalFrames % this.cycleLength
            : totalFrames % (this.cycleLength + 1); // +1 to include maxIndex

            console.log(`TOTAL FRAMES: ${totalFrames}`); // Added logging
        // Determine if frameNumber has changed
        if (this.frameNumber !== frameNumber) {
            this.frameNumber = frameNumber;
            this.logIPS(); // Log IPS during frame update
            this.notifyListeners({ frameChanged: true });
            console.log(`Frame updated to: ${this.frameNumber}`); // Added logging
        }
    }

    /**
     * Registers a callback to be invoked on frame changes.
     * @param {function} callback - The callback function.
     */
    onFrameChange(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notifies all registered listeners of an event.
     * @param {object} event - The event data.
     */
    notifyListeners(event = {}) {
        this.listeners.forEach(callback => callback(this.frameNumber, event));
    }

    /**
     * Logs the Index Per Second (IPS) based on frame changes.
     */
    logIPS() {
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastFrameChangeTime;
        this.lastFrameChangeTime = currentTime;

        // Add the elapsed time to the sliding window
        this.frameTimes.push(elapsed);

        // Keep only the last second's worth of time records
        let totalElapsed = 0;
        while (this.frameTimes.length > 0 && totalElapsed + this.frameTimes[0] > 1000) {
            this.frameTimes.shift(); // Remove old frame times
        }
        totalElapsed = this.frameTimes.reduce((a, b) => a + b, 0);

        // Calculate IPS as the number of changes in the last second
        const ips = (this.frameTimes.length / totalElapsed) * 1000; // Convert to changes per second

        if (ips !== this.lastLoggedIPS) {
            console.log(`Frame IPS: ${ips.toFixed(2)}, frameNumber: ${this.frameNumber}`);
            this.lastLoggedIPS = ips; // Update the last logged value
        }
    }

    /**
     * Retrieves the current frame number.
     * @returns {number} The current frame number.
     */
    getCurrentFrameNumber() {
        return this.frameNumber;
    }
}
