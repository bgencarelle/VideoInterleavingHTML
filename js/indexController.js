// js/indexController.js
import { FRAME_DURATION } from './config.js';
import { PINGPONG_MODE } from './config.js';

export class IndexController {
    constructor(fps = 60) { // Added default fps parameter
        this.frameNumber = 0; // Current frame number
        this.cycleLength = 0; // Total frames in a full cycle (forward + backward) if PingPong mode

        // Listeners for frame changes and cycle completions
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

        // Added pause state
        this.paused = false;

        // Variables for L key functionality (scheduling pause after cycles)
        this.isScheduling = false; // Indicates if a pause/reset is scheduled
        this.pauseAfterCycles = 0; // Number of cycles after which to pause
        this.completedCycles = 0; // Number of cycles completed since scheduling

        // Variables to track cycle completion
        this.previousFrameNumber = 0;
        this.currentCycle = 0;
    }

    /**
     * Initializes the IndexController with the maximum index.
     * Calculates cycle length based on PingPong mode.
     * @param {number} maxIndex - The maximum index value.
     */
    initialize(maxIndex) {
        this.cycleLength = PINGPONG_MODE ? maxIndex * 2 : maxIndex;
        //console.log(`IndexController initialized with cycleLength: ${this.cycleLength}`);
    }

    /**
     * Updates the current frame number based on the current timestamp.
     * @param {number} currentTimestamp - The current timestamp in milliseconds.
     */
    update(currentTimestamp) {
        if (this.paused) return; // Do not update if paused

        const elapsedTime = currentTimestamp - this.startTime;
        const totalFrames = Math.floor(elapsedTime / this.frameDuration);

        // Calculate frameNumber based on PingPong mode
        const frameNumber = PINGPONG_MODE
            ? totalFrames % this.cycleLength
            : totalFrames % (this.cycleLength + 1); // +1 to include maxIndex

        // Detect cycle completion
        let cycleCompleted = false;
        if (PINGPONG_MODE) {
            // In PingPong mode, a full cycle is forward and backward
            // Detect if frameNumber is 0 and previous was last frame
            if (frameNumber === 0 && this.previousFrameNumber === (this.cycleLength - 1)) {
                cycleCompleted = true;
            }
        } else {
            // Non-PingPong mode, a full cycle is from 0 to maxIndex and back to 0
            if (frameNumber === 0 && this.previousFrameNumber === this.cycleLength) {
                cycleCompleted = true;
            }
        }

        if (cycleCompleted) {
            this.currentCycle += 1;
            this.notifyListeners({ cycleCompleted: true, cycleNumber: this.currentCycle });

            // Check if scheduling is active and pause after cycles
            if (this.isScheduling) {
                if (this.currentCycle >= this.pauseAfterCycles) {
                    this.pause();
                    this.reset();
                    this.isScheduling = false;
                    this.completedCycles = 0;
                    this.currentCycle = 0;
                    this.notifyListeners({ scheduledPause: true });
                }
            }
        }

        // Determine if frameNumber has changed
        if (this.frameNumber !== frameNumber) {
            this.frameNumber = frameNumber;
            //this.logIPS(); // Log IPS during frame update
            this.notifyListeners({ frameChanged: true });
            //console.log(`Frame updated to: ${this.frameNumber}`); // Added logging
        }

        this.previousFrameNumber = frameNumber;
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
            //console.log(`Frame IPS: ${ips.toFixed(2)}, frameNumber: ${this.frameNumber}`);
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

    /**
     * Pauses the frame updates.
     */
    pause() {
        this.paused = true;
        this.notifyListeners({ paused: true });
    }

    /**
     * Unpauses the frame updates.
     */
    unpause() {
        this.paused = false;
        // Reset startTime to account for the paused duration
        this.startTime = performance.now() - (this.frameNumber * this.frameDuration);
        this.notifyListeners({ unpaused: true });
    }

    /**
     * Resets the frame index and start time.
     */
    reset() {
        this.frameNumber = 0;
        this.startTime = performance.now();
        this.currentCycle = 0; // Reset cycle count
        this.notifyListeners({ frameChanged: true, reset: true });
    }

    /**
     * Schedules a pause and reset after a specified number of cycles.
     * @param {number} cycles - Number of cycles after which to pause and reset.
     */
    schedulePauseAfterCycles(cycles = 2) {
        if (this.isScheduling) return; // Already scheduling

        this.isScheduling = true;
        this.pauseAfterCycles = cycles;
        this.currentCycle = 0;
        this.notifyListeners({ schedulingPause: true, cycles: cycles });
    }

    /**
     * Cancels any scheduled pause and reset.
     */
    cancelScheduledPause() {
        if (!this.isScheduling) return; // Nothing to cancel

        this.isScheduling = false;
        this.pauseAfterCycles = 0;
        this.currentCycle = 0;
        this.notifyListeners({ cancelScheduledPause: true });
    }
}
