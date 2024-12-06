// js/indexController.js

import { calculateFPS } from './utils.js';

export class IndexController {
    constructor() {
        this.index = 0;
        this.direction = 1; // 1 for forward, -1 for backward

        // Listeners for index changes
        this.listeners = [];

        // FPS calculation for index changes
        this.frameTimes = []; // Stores elapsed times for FPS calculation
        this.lastLoggedFPS = -1; // To avoid redundant logs
        this.lastIndexChangeTime = performance.now(); // Initialize with current timestamp
    }

    /**
     * Sets the current index to a new value.
     * @param {number} newIndex - The new index to set.
     * @param {number} maxIndex - The maximum allowed index.
     */
    setIndex(newIndex, maxIndex) {
        if (newIndex >= 0 && newIndex <= maxIndex) {
            this.index = newIndex;
            this.logFPS(); // Log FPS during setIndex
            this.notifyListeners({ indexChanged: true });
        } else {
            console.warn(`Index out of bounds: ${newIndex}`);
        }
    }

    /**
     * Increments the current index based on the direction.
     * Handles direction reversal at boundaries and logs FPS.
     * @param {number} maxIndex - The maximum allowed index.
     */
    increment(maxIndex) {
        let directionChanged = false;
        this.index += this.direction;

        if (this.index > maxIndex) {
            this.index = maxIndex;
            this.direction *= -1; // Reverse direction
            directionChanged = true;
        } else if (this.index < 0) {
            this.index = 0;
            this.direction *= -1; // Reverse direction
            directionChanged = true;
        }

        this.logFPS(); // Log FPS during increment

        // Notify listeners
        this.notifyListeners({ directionChanged });
    }

    /**
     * Sets the direction of index increment/decrement.
     * @param {number} newDirection - The new direction (1 or -1).
     */
    setDirection(newDirection) {
        if (newDirection === 1 || newDirection === -1) {
            if (this.direction !== newDirection) {
                this.direction = newDirection;
                this.notifyListeners({ directionChanged: true });
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
     * Logs the Frames Per Second (FPS) based on index changes.
     */
    logFPS() {
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastIndexChangeTime;
        this.lastIndexChangeTime = currentTime;

        const { fps, frameTimes } = calculateFPS(this.frameTimes, 60, elapsed);
        this.frameTimes = frameTimes;

        if (fps !== this.lastLoggedFPS) {
            //console.log(`Index FPS: ${fps}, index: ${this.index}, direction: ${this.direction}`);
            this.lastLoggedFPS = fps;
        }
    }

    /**
     * Retrieves the indices to preload based on the buffer size.
     * @param {number} bufferSize - The size of the buffer.
     * @returns {Array<number>} An array of indices to preload.
     */
    getPreloadIndices(bufferSize) {
        const indices = [];
        const bufferRange = Math.floor(bufferSize / 2);
        const currentIndex = this.index;

        // Preload indices ahead and behind the current index
        for (let offset = -bufferRange; offset <= bufferRange; offset++) {
            let idx = currentIndex + offset;
            // idx can be negative or exceed max index; we handle that later
            indices.push(idx);
        }

        return indices;
    }
}
