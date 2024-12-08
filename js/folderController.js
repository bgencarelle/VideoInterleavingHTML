// js/folderController.js

import { getRandomInt } from './utils.js';
import { FPS } from './config.js';
import { showModeOverlay } from './utils.js';

export class FolderController {
    constructor(mainFolders, floatFolders) {
        this.mainFolders = mainFolders;
        this.floatFolders = floatFolders;
        this.main_folder = 0;
        this.float_folder = 0;

        // Mode can be: 'RANDOM', 'EXTERNAL', 'INCREMENT'
        this.mode = 'RANDOM';

        // Initial random values
        this.rand_mult = getRandomInt(1, 9);
        this.rand_start = getRandomInt(FPS, 5 * FPS);

        this.nextResetIndex = null;
        this.nextFloatFolderChangeIndex = null;
        this.nextMainFolderChangeIndex = null;

        // Keep track of the last known index (used when applying manual folder changes)
        this.lastKnownIndex = 0;

        // Initial folder change schedule
        this.folderChangeSchedule = [{
            index: 0,
            main_folder: this.main_folder,
            float_folder: this.float_folder,
        }];

        // Debounce for external changes
        this.pendingExternalChange = null;
        this.debounceTimer = null;
        this.debounceDelay = 200; // ms

        // Initialize schedules and precompute
        this.scheduleInitialFolderChanges();
        this.scheduleFutureFolderChanges(0);
        this.precomputeFullCycleFolders();

        // Listeners for folder changes
        this.listeners = [];

        // Track direction for cycle detection
        this.lastDirection = null;

        // Setup controls
        this.setupExternalControlHooks();
    }

    setupExternalControlHooks() {
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();

            // Mode switching
            if (key === 'r') this.setMode('RANDOM');
            if (key === 'e') this.setMode('EXTERNAL');
            if (key === 'i') this.setMode('INCREMENT');

            // External mode folder controls only if mode is EXTERNAL
            if (this.mode === 'EXTERNAL') {
                let mainDelta = 0;
                let floatDelta = 0;
                if (key === 'q') mainDelta = 1;
                if (key === 'a') mainDelta = -1;
                if (key === 'w') floatDelta = 1;
                if (key === 's') floatDelta = -1;

                if (mainDelta !== 0 || floatDelta !== 0) {
                    this.queueExternalChange({ mainDelta, floatDelta });
                }
            }
        });
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
        this.main_folder = (this.main_folder + mainDelta) % this.mainFolders.length;
        if (this.main_folder < 0) this.main_folder = this.mainFolders.length + this.main_folder;

        this.float_folder = (this.float_folder + floatDelta) % this.floatFolders.length;
        if (this.float_folder < 0) this.float_folder = this.floatFolders.length + this.float_folder;

        this.applyManualFolderChange();
    }

    setMode(newMode) {
        if (!['RANDOM', 'EXTERNAL', 'INCREMENT'].includes(newMode)) {
            console.warn('[FolderController] Invalid mode requested:', newMode);
            return;
        }
        if (this.mode !== newMode) {
            this.mode = newMode;
            showModeOverlay(`Mode: ${this.mode}`);
        }
    }

    applyManualFolderChange() {
        const index = this.lastKnownIndex || 0;
        this.folderChangeSchedule.push({
            index,
            main_folder: this.main_folder,
            float_folder: this.float_folder,
        });
        this.notifyListeners({ folderChanged: true });
        // Immediate precompute for EXTERNAL mode changes or any manual changes
        this.precomputeFullCycleFolders();
        showModeOverlay(`External: Main=${this.main_folder}, Float=${this.float_folder}`);
    }

    scheduleInitialFolderChanges() {
        this.nextResetIndex = this.rand_start;
        this.nextFloatFolderChangeIndex = (FPS + 1) * this.rand_mult;
        this.nextMainFolderChangeIndex = 2 + FPS * this.rand_mult;
    }

    scheduleFutureFolderChanges(currentIndex) {
        // Cleanup old future changes
        const oldLength = this.folderChangeSchedule.length;
        this.folderChangeSchedule = this.folderChangeSchedule.filter(change => change.index <= currentIndex);

        // Random changes only in RANDOM mode
        if (this.mode === 'RANDOM') {
            const futureRandStart = getRandomInt(FPS, 5 * FPS);
            const futureRandMultFloat = getRandomInt(1, 12);
            const futureMainRandMult = getRandomInt(1, 9);

            // Reset event
            const nextResetIndex = currentIndex + futureRandStart;
            this.folderChangeSchedule.push({
                index: nextResetIndex,
                main_folder: 0,
                float_folder: 0,
            });

            // Float folder change event
            const nextFloatChangeIndex = currentIndex + ((FPS + 1) * futureRandMultFloat);
            const futureFloatFolder = getRandomInt(0, this.floatFolders.length - 1);
            this.folderChangeSchedule.push({
                index: nextFloatChangeIndex,
                main_folder: this.main_folder,
                float_folder: futureFloatFolder,
            });

            // Main folder change event
            const nextMainChangeIndex = currentIndex + (2 + FPS * futureMainRandMult);
            const futureMainFolder = getRandomInt(0, this.mainFolders.length - 1);
            this.folderChangeSchedule.push({
                index: nextMainChangeIndex,
                main_folder: futureMainFolder,
                float_folder: this.float_folder,
            });

            this.rand_start = futureRandStart;
            this.rand_mult = futureMainRandMult;
        } else {
            //console.log('[FolderController] Not scheduling future random changes since mode is not RANDOM.');
        }

        // As per original code, precompute after scheduling future changes
        this.precomputeFullCycleFolders();
    }

    findLatestChangeForIndex(i) {
        const changes = this.folderChangeSchedule;
        let low = 0;
        let high = changes.length - 1;
        let result = null;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (changes[mid].index <= i) {
                result = changes[mid];
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return result;
    }

    precomputeFullCycleFolders() {
        const maxIndex = this.getMaxIndex();
        this.precomputedFolderMap = new Array(maxIndex + 1);
        for (let i = 0; i <= maxIndex; i++) {
            const latestChange = this.findLatestChangeForIndex(i);
            if (latestChange) {
                this.precomputedFolderMap[i] = {
                    index: i,
                    main_folder: latestChange.main_folder,
                    float_folder: latestChange.float_folder,
                };
            } else {
                this.precomputedFolderMap[i] = {
                    index: i,
                    main_folder: this.main_folder,
                    float_folder: this.float_folder,
                };
            }
        }
    }

    updateFolders(index, direction) {
        this.lastKnownIndex = index;
        let folderChanged = false;
        const oldMain = this.main_folder;
        const oldFloat = this.float_folder;

        if (this.mode === 'RANDOM') {
            if ((index < this.rand_start) ||
                (direction === 1 && index > (10 * this.rand_mult) && index < (12 * this.rand_mult))) {
                this.float_folder = 0;
                this.main_folder = 0;
                this.rand_start = getRandomInt(FPS, 5 * FPS);
                folderChanged = true;
                this.nextResetIndex = index + this.rand_start;
            } else {
                this.rand_start = getRandomInt(FPS, 5 * FPS);

                if (index % ((FPS + 1) * this.rand_mult) === 0) {
                    this.float_folder = getRandomInt(0, this.floatFolders.length - 1);
                    this.rand_mult = getRandomInt(1, 12);
                    folderChanged = true;
                    this.nextFloatFolderChangeIndex = index + ((FPS + 1) * this.rand_mult);
                }

                if (index % (2 + FPS * this.rand_mult) === 0) {
                    this.main_folder = getRandomInt(0, this.mainFolders.length - 1);
                    this.rand_mult = getRandomInt(1, 9);
                    folderChanged = true;
                    this.nextMainFolderChangeIndex = index + (2 + FPS * this.rand_mult);
                }
            }

        } else if (this.mode === 'EXTERNAL') {
            // External changes handled by debounce and applyManualFolderChange()
        } else if (this.mode === 'INCREMENT') {
            let changed = false;
            if (index > 0 && index % FPS === 0) {
                this.main_folder = (this.main_folder + 1) % this.mainFolders.length;
                changed = true;
            }

            const floatInterval = Math.floor(FPS / 2);
            if (floatInterval > 0 && index > 0 && index % floatInterval === 0) {
                this.float_folder = (this.float_folder + 1) % this.floatFolders.length;
                changed = true;
            }

            if (changed) {
                folderChanged = true;
                this.folderChangeSchedule.push({
                    index: index,
                    main_folder: this.main_folder,
                    float_folder: this.float_folder,
                });
                // Original code also precomputed here
                this.precomputeFullCycleFolders();
            }
        }

        if (this.mode === 'RANDOM' && folderChanged) {
            this.folderChangeSchedule.push({
                index: index,
                main_folder: this.main_folder,
                float_folder: this.float_folder,
            });
            this.scheduleFutureFolderChanges(index);
            this.notifyListeners({ folderChanged: true });
        } else if ((this.mode === 'EXTERNAL' || this.mode === 'INCREMENT') && folderChanged) {
            this.notifyListeners({ folderChanged: true });
        }

        // Cycle detection:
        // If direction changes at index=0, we completed a forward or backward pass.
        // Two such passes (0 -> maxIndex -> 0) define a full cycle.
        // We track direction changes here if needed.
        if (this.lastDirection === null) {
            this.lastDirection = direction;
        } else {
            // Check if we returned to 0 and direction changed.
            if (index === 0 && direction !== this.lastDirection) {
                // We've hit a cycle boundary.
                // If desired, we could call precomputeFullCycleFolders() here again,
                // but per user instructions, it's not a big deal to always do it.
                // It's enough to know we can detect it and we understand how cycles work.

                // Example (not required):
                // if (this.mode === 'RANDOM' || this.mode === 'INCREMENT') {
                //     this.precomputeFullCycleFolders();
                // }
            }
            this.lastDirection = direction;
        }
    }

    getMaxIndex() {
        const fgFolder = this.mainFolders[this.main_folder];
        return fgFolder.image_list.length - 1;
    }

    onFolderChange(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(event = {}) {
        this.listeners.forEach(callback => callback(event));
    }

    getPreloadInfo(indices) {
        const maxIndex = this.getMaxIndex();
        return indices.map(idx => {
            if (idx < 0) idx = 0;
            if (idx > maxIndex) idx = maxIndex;

            const entry = this.precomputedFolderMap[idx];
            return entry ? entry : {
                index: idx,
                main_folder: this.main_folder,
                float_folder: this.float_folder,
            };
        });
    }
}
