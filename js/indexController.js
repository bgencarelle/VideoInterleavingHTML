// js/indexController.js
import { FRAME_DURATION } from './config.js';

export class IndexController {
    constructor() {
        this.index = 0;
        this.direction = 1; // 1 for forward, -1 for backward

        // Listeners for index changes
        this.listeners = [];

        // FPS calculation for index changes
        this.frameTimes = []; // Stores elapsed times for FPS calculation
        this.lastLoggedIPS = -1; // To avoid redundant logs
        this.lastIndexChangeTime = performance.now(); // Initialize with current timestamp

        // Time-based indexing
        this.frameDuration = FRAME_DURATION; // Duration per frame in milliseconds
        this.startTime = performance.now(); // Reference start time
    }

    /**
     * Sets the current index to a new value.
     * @param {number} newIndex - The new index to set.
     * @param {number} maxIndex - The maximum allowed index.
     */
    setIndex(newIndex, maxIndex) {
        if (newIndex >= 0 && newIndex <= maxIndex) {
            if (this.index !== newIndex) {
                this.index = newIndex;
                this.logIPS(); // Log IPS during setIndex
                this.notifyListeners({ indexChanged: true });
            }
        } else {
            console.warn(`Index out of bounds: ${newIndex}`);
        }
    }

    /**
     * Updates the current index based on the current timestamp.
     * Calculates the index directly from the elapsed time since start.
     * @param {number} currentTimestamp - The current timestamp in milliseconds.
     * @param {number} maxIndex - The maximum allowed index.
     */
    update(currentTimestamp, maxIndex) {
        const elapsedTime = currentTimestamp - this.startTime;
        const totalFrames = Math.floor(elapsedTime / this.frameDuration);

        const cycleLength = maxIndex * 2; // Forward and backward traversal
        const currentCycleFrame = totalFrames % cycleLength;

        let newIndex, newDirection;

        if (currentCycleFrame < maxIndex) {
            // Forward traversal
            newIndex = currentCycleFrame;
            newDirection = 1;
        } else {
            // Backward traversal
            newIndex = cycleLength - currentCycleFrame;
            newDirection = -1;
        }

        // Update direction if it has changed
        if (this.direction !== newDirection) {
            this.direction = newDirection;
            this.notifyListeners({ directionChanged: true });
        }

        // Update index if it has changed
        if (this.index !== newIndex) {
            this.index = newIndex;
            this.logIPS(); // Log IPS during index update
            this.notifyListeners({ indexChanged: true });
        }
    }

    /**
     * Sets the direction of index traversal.
     * Directly affects the direction for the next traversal cycle.
     * @param {number} newDirection - The new direction (1 or -1).
     */
    setDirection(newDirection) {
        if (newDirection === 1 || newDirection === -1) {
            if (this.direction !== newDirection) {
                this.direction = newDirection;
                this.notifyListeners({ directionChanged: true });
                // Adjust startTime to reflect the direction change immediately
                this.startTime = performance.now() - (this.index * this.frameDuration);
            }
        } else {
            console.warn(`Invalid direction: ${newDirection}`);
        }
    }

    /**
     * Registers a callback to be invoked on index changes.
     * @param {function} callback - The callback function.
     */
    onIndexChange(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notifies all registered listeners of an event.
     * @param {object} event - The event data.
     */
    notifyListeners(event = {}) {
        this.listeners.forEach(callback => callback(this.index, this.direction, event));
    }

    /**
     * Logs the Index Per Second (IPS) based on index changes.
     * This is not to calculate Frames Per Second, but currently just for logging
     */
    logIPS() {
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastIndexChangeTime;
        this.lastIndexChangeTime = currentTime;

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
            console.log(`Index IPS: ${ips.toFixed(2)}, index: ${this.index}, direction: ${this.direction}`);
            this.lastLoggedIPS = ips; // Update the last logged value
        }
    }

    /**
     * Retrieves the indices to preload based on the buffer size and current direction.
     * Prioritizes preloading in the traversal direction.
     * @param {number} bufferSize - The size of the buffer.
     * @returns {Array<number>} An array of indices to preload.
     */
    getPreloadIndices(bufferSize) {
        const indices = [];
        const bufferRange = Math.floor(bufferSize / 2);
        const currentIndex = this.index;
        const direction = this.direction;

        // Depending on the direction, prioritize preloading ahead or behind
        for (let i = 1; i <= bufferRange; i++) {
            // Preload in the traversal direction first
            let idxForward = currentIndex + direction * i;
            indices.push(idxForward);
        }

        for (let i = 1; i <= bufferRange; i++) {
            // Preload opposite direction second
            let idxBackward = currentIndex - direction * i;
            indices.push(idxBackward);
        }

        // Include the current index to ensure it's loaded
        indices.unshift(currentIndex);

        return indices;
    }
}
