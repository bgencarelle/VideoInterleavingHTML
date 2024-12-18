// js/folderController.js

import { showModeOverlay, setupKeyboardCallbacksFolder } from './utils.js';
import { PINGPONG_MODE, FPS } from './config.js';
import { RandomModeCalculator } from './randomModeCalc.js';

/**
 * Generates a filename by replacing the {index:04d} placeholder with the actual index.
 * @param {string} pattern - The image pattern containing the placeholder.
 * @param {number} index - The current index to replace in the pattern.
 * @returns {string} - The generated filename.
 */
function generateFileName(pattern, index) {
    // Extract the desired number of digits from the pattern
    const match = pattern.match(/\{index:(\d+)d\}/);
    if (match) {
        const digits = parseInt(match[1], 10);
        const indexStr = index.toString().padStart(digits, '0');
        return pattern.replace(/\{index:\d+d\}/, indexStr);
    }
    // If no match, return the pattern as is
    return pattern;
}

export class FolderController {
    constructor(mainFolders, floatFolders) {
        this.mainFolders = mainFolders;
        this.floatFolders = floatFolders;
        this.currentMainFolder = 0;
        this.currentFloatFolder = 0;
        this.mode = 'RANDOM';
        this.listeners = [];
        this.pendingExternalChange = null;
        this.debounceTimer = null;
        this.debounceDelay = 30;

        // Cache references
        this.currentMainFolderData = this.mainFolders[this.currentMainFolder];
        this.currentFloatFolderData = this.floatFolders[this.currentFloatFolder];

        // Initialize RandomModeCalculator
        this.randomModeCalc = new RandomModeCalculator(
            this.mainFolders,
            this.floatFolders,
            this.updateFolderState.bind(this)
        );
        setupKeyboardCallbacksFolder(this);
    }

    /**
     * Callback to update folder state based on random mode calculations.
     * @param {Object} event - Event object containing folder change information.
     */
    updateFolderState(event) {
        if (event.folderChanged) {
            this.notifyListeners({ folderChanged: true });
        }
        if (event.modeChanged) {
            // Handle mode change if needed
        }
    }

    /**
     * Handles external changes queued by keyboard interactions.
     * @param {Object} change - Object containing mainDelta and floatDelta.
     */
    queueExternalChange(change) {
        this.pendingExternalChange = change;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            this.applyExternalChangeIfPending();
        }, this.debounceDelay);
    }

    /**
     * Applies the pending external change to the current folders.
     */
    applyExternalChangeIfPending() {
        if (!this.pendingExternalChange) return;

        const { mainDelta, floatDelta } = this.pendingExternalChange;
        this.pendingExternalChange = null;

        this.currentMainFolder = (this.currentMainFolder + mainDelta) % this.mainFolders.length;
        if (this.currentMainFolder < 0) {
            this.currentMainFolder += this.mainFolders.length;
        }

        this.currentFloatFolder = (this.currentFloatFolder + floatDelta) % this.floatFolders.length;
        if (this.currentFloatFolder < 0) {
            this.currentFloatFolder += this.floatFolders.length;
        }

        // Update cached references
        this.currentMainFolderData = this.mainFolders[this.currentMainFolder];
        this.currentFloatFolderData = this.floatFolders[this.currentFloatFolder];

        this.applyManualFolderChange();
    }

    /**
     * Applies manual folder changes by notifying listeners and showing an overlay.
     */
    applyManualFolderChange() {
        this.notifyListeners({ folderChanged: true });
        showModeOverlay(`Manual: Main=${this.currentMainFolder}, Float=${this.currentFloatFolder}`);
    }

    /**
     * Sets the current mode of the controller.
     * @param {string} newMode - The new mode to set ('RANDOM', 'INCREMENT', 'EXTERNAL').
     */
    setMode(newMode) {
        const validModes = ['RANDOM', 'INCREMENT', 'EXTERNAL'];
        if (!validModes.includes(newMode)) {
            console.warn(`[FolderController] Invalid mode: ${newMode}`);
            return;
        }
        if (this.mode !== newMode) {
            this.mode = newMode;
            showModeOverlay(`Mode: ${this.mode}`);
            this.notifyListeners({ modeChanged: true });

            if (this.mode === 'RANDOM') {
                this.randomModeCalc.setRandomParameters();
            }
        }
    }

    /**
     * Updates folders based on the current mode and frame number.
     * This method should be called externally before requesting file paths.
     * @param {number} frameNumber - The current frame number.
     */
    updateFolders(frameNumber) {
        switch (this.mode) {
            case 'RANDOM':
                this.randomModeCalc.updateRandomMode(frameNumber);
                this.currentMainFolder = this.randomModeCalc.currentMainFolder;
                this.currentFloatFolder = this.randomModeCalc.currentFloatFolder;
                // Update cached references
                this.currentMainFolderData = this.mainFolders[this.currentMainFolder];
                this.currentFloatFolderData = this.floatFolders[this.currentFloatFolder];
                break;
            case 'INCREMENT':
                this.updateIncrementMode(frameNumber);
                break;
            case 'EXTERNAL':
                // No automatic updates in EXTERNAL mode
                break;
            default:
                console.warn(`[FolderController] Unknown mode: ${this.mode}`);
        }
    }

    /**
     * Updates folders in INCREMENT mode based on the frame number.
     * @param {number} frameNumber - The current frame number.
     */
    updateIncrementMode(frameNumber) {
        if (frameNumber > 0 && frameNumber % FPS === 0) {
            this.currentMainFolder = (this.currentMainFolder + 1) % this.mainFolders.length;
            this.currentFloatFolder = (this.currentFloatFolder + 1) % this.floatFolders.length;
            // Update cached references
            this.currentMainFolderData = this.mainFolders[this.currentMainFolder];
            this.currentFloatFolderData = this.floatFolders[this.currentFloatFolder];
            this.notifyListeners({ folderChanged: true });
        }
    }

    /**
     * Retrieves file paths for the current folders and the given frame number.
     * Ensure that updateFolders(frameNumber) is called before this method if needed.
     * @param {number} frameNumber - The current frame number.
     * @returns {Object} - An object containing mainImage and floatImage paths.
     */
    getFilePaths(frameNumber) {
        const mainFolder = this.mainFolders[this.currentMainFolder];
        const floatFolder = this.floatFolders[this.currentFloatFolder];

        // Ensure that frameNumber does not exceed max_index
        const mainIndex = this.getFrameIndex(frameNumber, mainFolder.max_index);
        const floatIndex = this.getFrameIndex(frameNumber, floatFolder.max_index);

        // Generate filenames based on the image_pattern
        const mainFileName = generateFileName(mainFolder.image_pattern, mainIndex);
        const floatFileName = generateFileName(floatFolder.image_pattern, floatIndex);

        // Concatenate folder_rel with the generated filename to get the full path
        const mainImage = `${mainFolder.folder_rel}/${mainFileName}`;
        const floatImage = `${floatFolder.folder_rel}/${floatFileName}`;

        return { mainImage, floatImage };
    }

    /**
     * Calculates the frame index based on frame number and max index.
     * Supports ping-pong mode if enabled.
     * @param {number} frameNumber - The current frame number.
     * @param {number} maxIndex - The maximum index (exclusive).
     * @returns {number} - The calculated frame index.
     */
    getFrameIndex(frameNumber, maxIndex) {
        if (maxIndex <= 0) return 0; // Prevent division by zero

        if (!PINGPONG_MODE) {
            return frameNumber % maxIndex;
        }
        const cycle = maxIndex * 2;
        const position = frameNumber % cycle;
        return position < maxIndex ? position : cycle - position - 1;
    }

    /**
     * Notifies all registered listeners with the provided event.
     * @param {Object} event - The event object.
     */
    notifyListeners(event = {}) {
        this.listeners.forEach((callback) => callback(event));
    }

    // Add methods to register listeners if not already present
    addListener(callback) {
        this.listeners.push(callback);
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }
}
