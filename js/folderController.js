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

        // Modes: 'RANDOM', 'INCREMENT', 'EXTERNAL'
        this.mode = 'RANDOM';

        // Listeners for folder changes
        this.listeners = [];

        // Initialize RANDOM mode variables
        this.rand_mult = getRandomInt(1, 9);
        this.rand_start = getRandomInt(FPS, 5 * FPS);

        // Precompute random sequences
        this.mainRandomSequence = [];
        this.floatRandomSequence = [];
        this.precomputeRandomSequences();

        // Debounce for external changes
        this.pendingExternalChange = null;
        this.debounceTimer = null;
        this.debounceDelay = 200; // ms

        // Bind event handler to ensure proper removal if needed
        this.boundKeydownHandler = this.handleKeydown.bind(this);

        // Setup controls
        this.setupExternalControlHooks();
    }

    /**
     * Precomputes random sequences for main and float folders (2x cycle).
     */
    precomputeRandomSequences() {
        this.mainRandomSequence = this.generateRandomSequence(this.mainFolders.length, 2);
        this.floatRandomSequence = this.generateRandomSequence(this.floatFolders.length, 2);
    }

    /**
     * Generates a random sequence of folder indices.
     * @param {number} folderCount - Number of folders.
     * @param {number} multiplier - How many times to repeat the cycle.
     * @returns {Array<number>} The generated random sequence.
     */
    generateRandomSequence(folderCount, multiplier) {
        const sequence = [];
        for (let i = 0; i < folderCount * multiplier; i++) {
            sequence.push(getRandomInt(0, folderCount - 1));
        }
        return sequence;
    }

    /**
     * Sets up external control hooks for mode switching and folder adjustments.
     */
    setupExternalControlHooks() {
        document.addEventListener('keydown', this.boundKeydownHandler);
    }

    /**
     * Handles keydown events for mode switching and folder adjustments.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    handleKeydown(e) {
        const key = e.key.toLowerCase();

        // Mode switching
        if (key === 'r') {
            this.setMode('RANDOM');
            return;
        }
        if (key === 'i') {
            this.setMode('INCREMENT');
            return;
        }
        if (key === 'e') {
            this.setMode('EXTERNAL');
            return;
        }

        // Folder adjustments in EXTERNAL mode
        if (this.mode === 'EXTERNAL') {
            let mainDelta = 0;
            let floatDelta = 0;

            switch (key) {
                case '1':
                    mainDelta = 1; // Increment main folder
                    break;
                case '2':
                    mainDelta = -1; // Decrement main folder
                    break;
                case '3':
                    floatDelta = 1; // Increment float folder
                    break;
                case '4':
                    floatDelta = -1; // Decrement float folder
                    break;
                default:
                    return; // Ignore other keys
            }

            // Queue the external change with the calculated deltas
            this.queueExternalChange({ mainDelta, floatDelta });
        }
    }

    /**
     * Debounce: Only keep the last external input and apply after a delay.
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
     */
    applyExternalChangeIfPending() {
        if (!this.pendingExternalChange) return;

        const { mainDelta, floatDelta } = this.pendingExternalChange;
        this.pendingExternalChange = null; // Clear pending change

        // Apply changes with rollover
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
     * Applies manual folder changes.
     */
    applyManualFolderChange() {
        this.notifyListeners({ folderChanged: true });
        showModeOverlay(`Manual: Main=${this.currentMainFolder}, Float=${this.currentFloatFolder}`);
    }

    /**
     * Sets the current mode.
     * @param {string} newMode - The new mode ('RANDOM', 'INCREMENT', 'EXTERNAL').
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

            // Reset RANDOM mode variables when switching to RANDOM
            if (this.mode === 'RANDOM') {
                this.rand_mult = getRandomInt(1, 9);
                this.rand_start = getRandomInt(FPS, 5 * FPS);
                // Reset random sequences
                this.precomputeRandomSequences();
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
            case 'EXTERNAL':
                // In EXTERNAL mode, do not auto-update folders
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

        if (
            frameNumber < this.rand_start ||
            (frameNumber > 10 * this.rand_mult && frameNumber < 12 * this.rand_mult)
        ) {
            this.currentFloatFolder = 0;
            this.currentMainFolder = 0;
            this.rand_start = getRandomInt(FPS, 5 * FPS);
            this.notifyListeners({ folderChanged: true });
        } else {
            this.rand_start = getRandomInt(FPS, 5 * FPS);

            if (frameNumber % ((FPS + 1) * this.rand_mult) === 0) {
                this.currentFloatFolder = this.getNextRandomFloatFolder();
                this.rand_mult = getRandomInt(1, 12);
                this.notifyListeners({ folderChanged: true });
            }

            if (frameNumber % (2 + FPS * this.rand_mult) === 0) {
                this.currentMainFolder = this.getNextRandomMainFolder();
                this.rand_mult = getRandomInt(1, 9);
                this.notifyListeners({ folderChanged: true });
            }
        }
    }

    /**
     * Retrieves the next random main folder from the precomputed sequence.
     * Recomputes the sequence if necessary.
     * @returns {number} The next main folder index.
     */
    getNextRandomMainFolder() {
        if (this.mainRandomSequence.length === 0) {
            // Recompute if sequence is empty
            this.precomputeRandomSequences();
        }
        return this.mainRandomSequence.shift();
    }

    /**
     * Retrieves the next random float folder from the precomputed sequence.
     * Recomputes the sequence if necessary.
     * @returns {number} The next float folder index.
     */
    getNextRandomFloatFolder() {
        if (this.floatRandomSequence.length === 0) {
            // Recompute if sequence is empty
            this.precomputeRandomSequences();
        }
        return this.floatRandomSequence.shift();
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
        const mainIndex = PINGPONG_MODE
            ? this.getPingPongIndex(frameNumber, mainFolder.image_list.length)
            : frameNumber % mainFolder.image_list.length;
        const floatIndex = PINGPONG_MODE
            ? this.getPingPongIndex(frameNumber, floatFolder.image_list.length)
            : frameNumber % floatFolder.image_list.length;

        const mainImage = mainFolder.image_list[mainIndex];
        const floatImage = floatFolder.image_list[floatIndex];

        return {
            mainImage: mainImage,
            floatImage: floatImage,
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
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    /**
     * Notifies all registered listeners of an event.
     * @param {object} event - The event data.
     */
    notifyListeners(event = {}) {
        this.listeners.forEach((callback) => callback(event));
    }

    /**
     * Retrieves the maximum number of images across all main and float folders.
     * Useful for setting up IndexController's cycleLength.
     * @returns {number} The maximum number of images in any folder.
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
        console.log(
            `getMaxIndex: maxMain=${maxMain}, maxFloat=${maxFloat}, maxIndex=${maxIndex}`
        );
        return maxIndex;
    }

    /**
     * Destroys the FolderController by removing event listeners and clearing timers.
     * Call this method when the FolderController is no longer needed to prevent memory leaks.
     */
    destroy() {
        document.removeEventListener('keydown', this.boundKeydownHandler);
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.listeners = [];
    }
}
