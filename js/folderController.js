// js/folderController.js

import { getRandomInt } from './utils.js';
import { showModeOverlay } from './utils.js';
import { PINGPONG_MODE, FPS } from './config.js'; // Ensure FPS is imported

export class FolderController {
    /**
     * Constructs the FolderController.
     * @param {Array<Object>} mainFolders - Array of main folder objects.
     * @param {Array<Object>} floatFolders - Array of float folder objects.
     */
    constructor(mainFolders, floatFolders) {
        this.mainFolders = mainFolders;
        this.floatFolders = floatFolders;
        this.currentMainFolder = 0;
        this.currentFloatFolder = 0;

        // Modes: 'RANDOM', 'INCREMENT'
        this.mode = 'RANDOM';

        // Listeners for folder changes
        this.listeners = [];

        // Initialize RANDOM mode variables
        this.rand_mult = getRandomInt(1, 9);
        this.rand_start = getRandomInt(FPS, 5 * FPS);

        // Debounce for external changes (if not needed, can be removed)
        this.pendingExternalChange = null;
        this.debounceTimer = null;
        this.debounceDelay = 200; // ms

        // Setup controls
        this.setupExternalControlHooks();
    }

    /**
     * Sets up external control hooks for mode switching.
     */
    setupExternalControlHooks() {
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();

            // Mode switching
            if (key === 'r') this.setMode('RANDOM');
            if (key === 'i') this.setMode('INCREMENT');

            // Remove 'e' mode if EXTERNAL is no longer needed
            // if (key === 'e') this.setMode('EXTERNAL'); // Removed
        });
    }

    /**
     * Debounce: Only keep the last external input and apply after a delay.
     * (If EXTERNAL mode is removed, this can be omitted)
     */
    queueExternalChange(change) {
        this.pendingExternalChange = change;

        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            this.applyExternalChangeIfPending();
        }, this.debounceDelay);
    }

    /**
     * Apply the pending external change if available.
     * (If EXTERNAL mode is removed, this can be omitted)
     */
    applyExternalChangeIfPending() {
        if (!this.pendingExternalChange) return;

        const { mainDelta, floatDelta } = this.pendingExternalChange;
        this.pendingExternalChange = null; // Clear pending change

        // Apply changes with rollover
        this.currentMainFolder = (this.currentMainFolder + mainDelta) % this.mainFolders.length;
        if (this.currentMainFolder < 0) this.currentMainFolder = this.mainFolders.length + this.currentMainFolder;

        this.currentFloatFolder = (this.currentFloatFolder + floatDelta) % this.floatFolders.length;
        if (this.currentFloatFolder < 0) this.currentFloatFolder = this.floatFolders.length + this.currentFloatFolder;

        this.applyManualFolderChange();
    }

    /**
     * Applies manual folder changes.
     */
    applyManualFolderChange() {
        this.notifyListeners({ folderChanged: true });
        showModeOverlay(`Manual: Main=${this.currentMainFolder}, Float=${this.currentFloatFolder}`);
    }

    /**
     * Sets the current mode.
     * @param {string} newMode - The new mode ('RANDOM', 'INCREMENT').
     */
    setMode(newMode) {
        const validModes = ['RANDOM', 'INCREMENT']; // Removed 'EXTERNAL'
        if (!validModes.includes(newMode)) {
            console.warn(`[FolderController] Invalid mode: ${newMode}`);
            return;
        }
        if (this.mode !== newMode) {
            this.mode = newMode;
            showModeOverlay(`Mode: ${this.mode}`);
            this.notifyListeners({ modeChanged: true });

            // Reset RANDOM mode variables when switching to RANDOM
            if (this.mode === 'RANDOM') {
                this.rand_mult = getRandomInt(1, 9);
                this.rand_start = getRandomInt(FPS, 5 * FPS);
            }
        }
    }

    /**
     * Updates the current folders based on the frame number.
     * @param {number} frameNumber - The current frame number.
     */
    updateFolders(frameNumber) {
        switch (this.mode) {
            case 'RANDOM':
                this.updateRandomMode(frameNumber);
                break;
            case 'INCREMENT':
                this.updateIncrementMode(frameNumber);
                break;
            default:
                console.warn(`[FolderController] Unknown mode: ${this.mode}`);
        }
    }

    /**
     * Updates folders in RANDOM mode.
     * @param {number} frameNumber - The current frame number.
     */
    updateRandomMode(frameNumber) {
        if (this.mode !== 'RANDOM') return;

        if ((frameNumber < this.rand_start) ||
            (frameNumber > (10 * this.rand_mult) && frameNumber < (12 * this.rand_mult))) {
            this.currentFloatFolder = 0;
            this.currentMainFolder = 0;
            this.rand_start = getRandomInt(FPS, 5 * FPS);
            this.notifyListeners({ folderChanged: true });
        } else {
            this.rand_start = getRandomInt(FPS, 5 * FPS);

            if (frameNumber % ((FPS + 1) * this.rand_mult) === 0) {
                this.currentFloatFolder = getRandomInt(0, this.floatFolders.length - 1);
                this.rand_mult = getRandomInt(1, 12);
                this.notifyListeners({ folderChanged: true });
            }

            if (frameNumber % (2 + FPS * this.rand_mult) === 0) {
                this.currentMainFolder = getRandomInt(0, this.mainFolders.length - 1);
                this.rand_mult = getRandomInt(1, 9);
                this.notifyListeners({ folderChanged: true });
            }
        }
    }

    /**
     * Updates folders in INCREMENT mode.
     * @param {number} frameNumber - The current frame number.
     */
    updateIncrementMode(frameNumber) {
        // Increment folders every FPS frames (~1 second at FPS rate)
        if (frameNumber > 0 && frameNumber % FPS === 0) {
            this.currentMainFolder = (this.currentMainFolder + 1) % this.mainFolders.length;
            this.currentFloatFolder = (this.currentFloatFolder + 1) % this.floatFolders.length;
            this.notifyListeners({ folderChanged: true });
        }
    }

    /**
     * Retrieves the current file paths based on the frame number.
     * @param {number} frameNumber - The current frame number.
     * @returns {Object} An object containing the main and float image paths.
     */
    getFilePaths(frameNumber) {
        this.updateFolders(frameNumber);

        const mainFolder = this.mainFolders[this.currentMainFolder];
        const floatFolder = this.floatFolders[this.currentFloatFolder];

        // Assuming frameNumber maps directly to image index within the folder
        const mainIndex = PINGPONG_MODE ? this.getPingPongIndex(frameNumber, mainFolder.image_list.length) : frameNumber % mainFolder.image_list.length;
        const floatIndex = PINGPONG_MODE ? this.getPingPongIndex(frameNumber, floatFolder.image_list.length) : frameNumber % floatFolder.image_list.length;

        const mainImage = mainFolder.image_list[mainIndex];
        const floatImage = floatFolder.image_list[floatIndex];

        return {
            mainImage: mainImage,
            floatImage: floatImage
        };
    }

    /**
     * Calculates the index for PingPong mode.
     * @param {number} frameNumber - The current frame number.
     * @param {number} listLength - The length of the image list.
     * @returns {number} The calculated index.
     */
    getPingPongIndex(frameNumber, listLength) {
        const cycle = listLength * 2;
        const position = frameNumber % cycle;
        return position < listLength ? position : cycle - position - 1;
    }

    /**
     * Registers a callback to be invoked on folder changes.
     * @param {function} callback - The callback function.
     */
    onFolderChange(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notifies all registered listeners of an event.
     * @param {object} event - The event data.
     */
    notifyListeners(event = {}) {
        this.listeners.forEach(callback => callback(event));
    }

    /**
     * Retrieves the maximum number of images across all main and float folders.
     * Useful for setting up IndexController's cycleLength.
     * @returns {number} The maximum number of images in any folder.
     */
    getMaxIndex() {
        let maxMain = 0;
        let maxFloat = 0;
        this.mainFolders.forEach(folder => {
            if (folder.image_list.length > maxMain) {
                maxMain = folder.image_list.length;
            }
        });
        this.floatFolders.forEach(folder => {
            if (folder.image_list.length > maxFloat) {
                maxFloat = folder.image_list.length;
            }
        });
        const maxIndex = Math.max(maxMain, maxFloat);
        console.log(`getMaxIndex: maxMain=${maxMain}, maxFloat=${maxFloat}, maxIndex=${maxIndex}`);
        return maxIndex;
    }
}
