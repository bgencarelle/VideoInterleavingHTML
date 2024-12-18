// js/indexController.js

import {PINGPONG_MODE, INDEX_UPDATE_DURATION} from './config.js';

/**
 * IndexController manages the progression of frames and cycles within the animation.
 * It handles frame updates based on time, manages Ping-Pong cycling modes,
 * and notifies registered listeners about frame changes and cycle completions.
 */
export class IndexController {
    constructor() {
        // Current frame number
        this.frameNumber = 0;

        // Total frames in a full cycle (forward + backward) if PingPong mode
        this.cycleLength = 0;

        // Listeners for frame changes and cycle completions
        this.listeners = [];

        // Duration per frame in milliseconds
        this.frameDuration = INDEX_UPDATE_DURATION;

        // Reference start time for animation
        this.startTime = performance.now();

        // Last update timestamp
        this.lastUpdateTime = this.startTime;

        // Total elapsed time excluding paused durations
        this.elapsedTime = 0;

        // Pause state flag
        this.paused = false;

        // Previous frame number to detect cycle completions
        this.previousFrameNumber = 0;

    }

    /**
     * Initializes the IndexController with the maximum index.
     * Calculates cycle length based on PingPong mode.
     * @param {number} maxIndex - The maximum index value.
     */
    initialize(maxIndex) {
        if (typeof maxIndex !== 'number' || maxIndex <= 0) {
            console.error('initialize requires a positive number as maxIndex');
            return;
        }

        if (PINGPONG_MODE) {
            // In PingPong mode, a full cycle is forward and backward
            this.cycleLength = maxIndex * 2;
        } else {
            // In non-PingPong mode, a full cycle is from 0 to maxIndex inclusive
            this.cycleLength = maxIndex + 1;
        }

        console.log(`IndexController initialized with cycleLength: ${this.cycleLength}`);
    }

    /**
     * Updates the current frame number based on the current timestamp.
     * @param {number} currentTimestamp - The current timestamp in milliseconds.
     */
    update(currentTimestamp) {
        if (this.paused) return; // Do not update if paused

        // Calculate delta time since last update
        const deltaTime = currentTimestamp - this.lastUpdateTime;
        this.lastUpdateTime = currentTimestamp;

        // Update elapsed time
        this.elapsedTime += deltaTime;

        // Calculate total frames based on elapsed time
        const totalFrames = Math.floor(this.elapsedTime / this.frameDuration);

        // Calculate frameNumber based on PingPong mode
        const frameNumber = totalFrames % this.cycleLength;

        if (PINGPONG_MODE) {
            // In PingPong mode, a full cycle is forward and backward
            // Detect if frameNumber is 0 and previous was last frame
            if (frameNumber === 0 && this.previousFrameNumber === (this.cycleLength - 1)) {
            }
        } else {
            // In non-PingPong mode, a full cycle is from 0 to maxIndex inclusive
            if (frameNumber === 0 && this.previousFrameNumber === (this.cycleLength - 1)) {
            }
        }
        // Determine if frameNumber has changed
        if (this.frameNumber !== frameNumber) {
            this.frameNumber = frameNumber;
            //this.notifyListeners({frameChanged: true});
            //console.log(`Frame updated to: ${this.frameNumber}`);
        }

        this.previousFrameNumber = frameNumber;
    }


    /**
     * Notifies all registered listeners of an event.
     * @param {object} event - The event data.
     */
    notifyListeners(event = {}) {
        this.listeners.forEach(callback => {
            try {
                callback(this.frameNumber, event);
            } catch (err) {
                console.error('Error in listener callback:', err);
            }
        });
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
        if (!this.paused) {
            this.paused = true;
            this.notifyListeners({paused: true});
            console.log('Animation paused.');
        }
    }

    /**
     * Unpauses the frame updates.
     */
    unpause() {
        if (this.paused) {
            const now = performance.now();
            const pausedDuration = now - this.lastUpdateTime;
            this.elapsedTime += pausedDuration;
            this.lastUpdateTime = now;
            this.paused = false;
            this.notifyListeners({unpaused: true});
            console.log('Animation unpaused.');
        }
    }

    /**
     * Resets the frame index, elapsed time, and cycle count.
     */
    reset() {
        this.frameNumber = 0;
        this.elapsedTime = 0;
        this.lastUpdateTime = performance.now();
        this.notifyListeners({frameChanged: true, reset: true});
        console.log('Animation reset.');
    }

}
