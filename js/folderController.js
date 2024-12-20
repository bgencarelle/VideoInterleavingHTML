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

        // Initialize RandomModeCalculator (do not alter internal logic)
        this.randomModeCalc = new RandomModeCalculator(
            this.mainFolders,
            this.floatFolders,
            this.updateFolderState.bind(this)
        );

        // Generate image_list from image_pattern if necessary (unchanged)
        this.generateImageLists(this.mainFolders);
        this.generateImageLists(this.floatFolders);

        // Setup keyboard callbacks as before
        this.boundKeydownHandler = setupKeyboardCallbacksFolder(this);
    }

    /**
     * Generates the image_list for folders based on image_pattern and max_file_index.
     * Retaining original approach with forEach.
     */
    generateImageLists(folders) {
        folders.forEach(folder => {
            if (!folder.image_list && folder.image_pattern && typeof folder.max_file_index === 'number') {
                folder.image_list = this.generateImageListFromPattern(folder.folder_rel, folder.image_pattern, folder.max_file_index);
            }
        });
    }

    /**
     * Generates an image list based on pattern and max index.
     * This logic is unchanged from original.
     */
    generateImageListFromPattern(folderRel, pattern, maxIndex) {
        const imageList = [];
        const regex = /\{index(?::(\d+)d)?\}/g;
        const normalizedFolderRel = folderRel.endsWith('/') ? folderRel.slice(0, -1) : folderRel;

        for (let i = 0; i <= maxIndex; i++) {
            let fileName = pattern.replace(regex, (match, padding) => {
                if (padding) {
                    return String(i).padStart(parseInt(padding, 10), '0');
                }
                return i;
            });
            const fullPath = `${normalizedFolderRel}/${fileName}`;
            imageList.push(fullPath);
        }
        return imageList;
    }

    /**
     * Callback to update folder state based on random mode.
     */
    updateFolderState(event) {
        if (event.folderChanged) {
            this.notifyListeners({ folderChanged: true });
        }
        if (event.modeChanged) {
            // Mode changes handled if needed
        }
    }

    /**
     * Handles external changes with debounce logic as in original.
     */
    queueExternalChange(change) {
        this.pendingExternalChange = change;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            this.applyExternalChangeIfPending();
        }, this.debounceDelay);
    }

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

    applyManualFolderChange() {
        this.notifyListeners({ folderChanged: true });
        showModeOverlay(`Manual: Main=${this.currentMainFolder}, Float=${this.currentFloatFolder}`);
    }

    /**
     * Set mode without changing public interface.
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
     * Update folders based on mode each frame.
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
                // External mode updates happen via external input
                break;
            default:
                console.warn(`[FolderController] Unknown mode: ${this.mode}`);
        }
    }

    updateIncrementMode(frameNumber) {
        if (frameNumber > 0 && frameNumber % 3 === 0) {
            this.currentMainFolder = (this.currentMainFolder + 1) % this.mainFolders.length;
            this.currentFloatFolder = (this.currentFloatFolder + 2) % this.floatFolders.length;
            this.notifyListeners({ folderChanged: true });
        }
    }

    /**
     * Retrieve file paths. This remains largely unchanged.
     */
    getFilePaths(frameNumber) {
        const mainFolder = this.mainFolders[this.currentMainFolder];
        const floatFolder = this.floatFolders[this.currentFloatFolder];
        const mainIndex = this.getFrameIndex(frameNumber, mainFolder.image_list.length);
        const floatIndex = this.getFrameIndex(frameNumber, floatFolder.image_list.length);
        return {
            mainImage: mainFolder.image_list[mainIndex],
            floatImage: floatFolder.image_list[floatIndex]
        };
    }

    /**
     * Restore original logic for getFrameIndex to handle PINGPONG_MODE conditionally.
     * Even if PINGPONG_MODE never changes, having this check might be cheaper than always doing ping-pong math.
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
     * Optimized notifyListeners: Early return if no listeners.
     */
    notifyListeners(event = {}) {
        if (this.listeners.length === 0) return;
        this.listeners.forEach((callback) => callback(event));
    }
}
