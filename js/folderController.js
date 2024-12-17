// js/folderController.js

import { showModeOverlay, setupKeyboardCallbacksFolder } from './utils.js';
import { PINGPONG_MODE, FPS } from './config.js';
import { RandomModeCalculator } from './randomModeCalc.js';

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
        this.debounceDelay = 200;

        // Initialize RandomModeCalculator
        this.randomModeCalc = new RandomModeCalculator(
            this.mainFolders,
            this.floatFolders,
            this.updateFolderState.bind(this)
        );

        // Setup keyboard callbacks using utils.js
        this.boundKeydownHandler = setupKeyboardCallbacksFolder(this);
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
            this.currentMainFolder = this.mainFolders.length + this.currentMainFolder;
        }

        this.currentFloatFolder = (this.currentFloatFolder + floatDelta) % this.floatFolders.length;
        if (this.currentFloatFolder < 0) {
            this.currentFloatFolder = this.floatFolders.length + this.currentFloatFolder;
        }

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

        const mainIndex = this.getFrameIndex(frameNumber, mainFolder.image_list.length);
        const floatIndex = this.getFrameIndex(frameNumber, floatFolder.image_list.length);

        const mainImage = mainFolder.image_list[mainIndex];
        const floatImage = floatFolder.image_list[floatIndex];

        return { mainImage, floatImage };
    }

    /**
     * Calculates the frame index based on frame number and list length.
     * Supports ping-pong mode if enabled.
     * @param {number} frameNumber - The current frame number.
     * @param {number} listLength - The length of the image list.
     * @returns {number} - The calculated frame index.
     */
    getFrameIndex(frameNumber, listLength) {
        if (!PINGPONG_MODE) {
            return frameNumber % listLength;
        }
        const cycle = listLength * 2;
        const position = frameNumber % cycle;
        return position < listLength ? position : cycle - position - 1;
    }

    /**
     * Registers a callback to be invoked on folder changes.
     * @param {Function} callback - The callback function.
     */
    onFolderChange(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    /**
     * Notifies all registered listeners with the provided event.
     * @param {Object} event - The event object.
     */
    notifyListeners(event = {}) {
        this.listeners.forEach((callback) => callback(event));
    }

    /**
     * Retrieves the maximum index among all main and float folders.
     * @returns {number} - The maximum index.
     */
    getMaxIndex() {
        let maxMain = 0;
        let maxFloat = 0;
        this.mainFolders.forEach((folder) => {
            if (folder.image_list.length > maxMain) {
                maxMain = folder.image_list.length;
            }
        });
        this.floatFolders.forEach((folder) => {
            if (folder.image_list.length > maxFloat) {
                maxFloat = folder.image_list.length;
            }
        });
        const maxIndex = Math.max(maxMain, maxFloat);
        console.log(`getMaxIndex: maxMain=${maxMain}, maxFloat=${maxFloat}, maxIndex=${maxIndex}`);
        return maxIndex;
    }

    /**
     * Cleans up event listeners and timers.
     */
    destroy() {
        if (this.boundKeydownHandler) {
            this.boundKeydownHandler();
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.listeners = [];
    }
}
