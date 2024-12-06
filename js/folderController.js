// js/folderController.js

import { getRandomInt } from './utils.js';
import { FPS } from './config.js';

export class FolderController {
    constructor(mainFolders, floatFolders) {
        this.mainFolders = mainFolders;
        this.floatFolders = floatFolders;
        this.main_folder = 0;
        this.float_folder = 0;

        // Initial random values
        this.rand_mult = getRandomInt(1, 9);
        this.rand_start = getRandomInt(FPS, 5 * FPS);

        this.nextResetIndex = null;
        this.nextFloatFolderChangeIndex = null;
        this.nextMainFolderChangeIndex = null;

        // Initially, we know the current folders at index 0
        this.folderChangeSchedule = [{
            index: 0,
            main_folder: this.main_folder,
            float_folder: this.float_folder,
        }];

        // Initialize next change indices and schedule initial future changes
        this.scheduleInitialFolderChanges();
        this.scheduleFutureFolderChanges(0);

        // Listeners for folder changes
        this.listeners = [];
    }

    /**
     * Schedules the initial folder changes based on current rand_start and rand_mult.
     */
    scheduleInitialFolderChanges() {
        this.nextResetIndex = this.rand_start;
        this.nextFloatFolderChangeIndex = (FPS + 1) * this.rand_mult;
        this.nextMainFolderChangeIndex = 2 + FPS * this.rand_mult;

        console.log('[FolderController] Initial changes scheduled:', {
            nextResetIndex: this.nextResetIndex,
            nextFloatFolderChangeIndex: this.nextFloatFolderChangeIndex,
            nextMainFolderChangeIndex: this.nextMainFolderChangeIndex,
        });
    }

    /**
     * After a folder change occurs, schedule future folder changes.
     * This ensures that the folderChangeSchedule always contains upcoming changes.
     * @param {number} currentIndex - The current index at which a change occurred.
     */
    scheduleFutureFolderChanges(currentIndex) {
        console.log(`[FolderController] Scheduling future folder changes from index ${currentIndex}.`);

        // Remove any future changes beyond the current index (cleanup)
        const oldLength = this.folderChangeSchedule.length;
        this.folderChangeSchedule = this.folderChangeSchedule.filter(change => change.index <= currentIndex);
        if (this.folderChangeSchedule.length !== oldLength) {
            console.log('[FolderController] Cleaned up old future changes. New schedule length:', this.folderChangeSchedule.length);
        }

        // Calculate future events
        const futureRandStart = getRandomInt(FPS, 5 * FPS);
        const futureRandMultFloat = getRandomInt(1, 12); // For float changes
        const futureMainRandMult = getRandomInt(1, 9);   // For main changes

        // Schedule future changes
        // 1. Reset event
        const nextResetIndex = currentIndex + futureRandStart;
        this.folderChangeSchedule.push({
            index: nextResetIndex,
            main_folder: 0,
            float_folder: 0,
        });

        // 2. Float folder change event
        const nextFloatChangeIndex = currentIndex + ((FPS + 1) * futureRandMultFloat);
        const futureFloatFolder = getRandomInt(0, this.floatFolders.length - 1);
        this.folderChangeSchedule.push({
            index: nextFloatChangeIndex,
            main_folder: this.main_folder,
            float_folder: futureFloatFolder,
        });

        // 3. Main folder change event
        const nextMainChangeIndex = currentIndex + (2 + FPS * futureMainRandMult);
        const futureMainFolder = getRandomInt(0, this.mainFolders.length - 1);
        this.folderChangeSchedule.push({
            index: nextMainChangeIndex,
            main_folder: futureMainFolder,
            float_folder: this.float_folder,
        });

        // Update rand_start and rand_mult for the next cycle
        this.rand_start = futureRandStart;
        this.rand_mult = futureMainRandMult;

        console.log('[FolderController] Future changes scheduled:', {
            nextResetIndex,
            nextFloatChangeIndex,
            nextMainChangeIndex,
            futureMainFolder,
            futureFloatFolder,
            rand_start: this.rand_start,
            rand_mult: this.rand_mult,
        });

        //console.log('[FolderController] Updated folderChangeSchedule:', this.folderChangeSchedule);
    }

    /**
     * Updates folders based on the current index and rules.
     * @param {number} index - The current index.
     * @param {number} direction - The current direction.
     */
    updateFolders(index, direction) {
        let folderChanged = false;
        const oldMain = this.main_folder;
        const oldFloat = this.float_folder;

        // Reset conditions based on direction
        if (
            (index < this.rand_start) ||
            (direction === 1 && index > (10 * this.rand_mult) && index < (12 * this.rand_mult))
        ) {
            this.float_folder = 0;
            this.main_folder = 0;
            this.rand_start = getRandomInt(FPS, 5 * FPS);
            folderChanged = true;

            // Schedule the next reset
            this.nextResetIndex = index + this.rand_start;
        } else {
            this.rand_start = getRandomInt(FPS, 5 * FPS);

            // Change float folder at intervals
            if (index % ((FPS + 1) * this.rand_mult) === 0) {
                this.float_folder = getRandomInt(0, this.floatFolders.length - 1);
                this.rand_mult = getRandomInt(1, 12); // Update random multiplier
                console.log('[FolderController] Float folder changed at index', index, 'to:', this.float_folder);
                folderChanged = true;

                // Schedule the next float_folder change
                this.nextFloatFolderChangeIndex = index + ((FPS + 1) * this.rand_mult);
            }

            // Change main folder at different intervals
            if (index % (2 + FPS * this.rand_mult) === 0) {
                this.main_folder = getRandomInt(0, this.mainFolders.length - 1);
                this.rand_mult = getRandomInt(1, 9); // Update random multiplier
                console.log('[FolderController] Main folder changed at index', index, 'to:', this.main_folder);
                folderChanged = true;

                // Schedule the next main_folder change
                this.nextMainFolderChangeIndex = index + (2 + FPS * this.rand_mult);
            }
        }

        if (folderChanged) {
            console.log('[FolderController] Folder changed at index', index, {
                oldMain,
                oldFloat,
                newMain: this.main_folder,
                newFloat: this.float_folder,
            });

            this.folderChangeSchedule.push({
                index: index, // The index at which the change occurred
                main_folder: this.main_folder,
                float_folder: this.float_folder,
            });

            // After recording the current change, schedule future changes
            this.scheduleFutureFolderChanges(index);

            // Notify listeners that folders have changed
            this.notifyListeners({ folderChanged: true });
        }
    }

    /**
     * Retrieves the current maximum index based on the current main_folder.
     * @returns {number} The maximum index.
     */
    getMaxIndex() {
        const fgFolder = this.mainFolders[this.main_folder];
        return fgFolder.image_list.length - 1;
    }

    /**
     * Registers a callback to be invoked when folders change.
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
     * Provides preload information for a given set of indices.
     * @param {Array<number>} indices - The indices for which to provide preload info.
     * @returns {Array} An array of preload information objects.
     */
    getPreloadInfo(indices) {
        const info = indices.map(idx => {
            // Find the latest folder change that occurred at or before this idx
            const applicableChanges = this.folderChangeSchedule.filter(change => change.index <= idx);
            const latestChange = applicableChanges.length > 0 ? applicableChanges[applicableChanges.length - 1] : null;

            if (latestChange) {
                return {
                    index: idx,
                    main_folder: latestChange.main_folder,
                    float_folder: latestChange.float_folder,
                };
            } else {
                // Should not happen since we always have at least one entry at index 0
                return {
                    index: idx,
                    main_folder: this.main_folder,
                    float_folder: this.float_folder,
                };
            }
        });

        //console.log('[FolderController] getPreloadInfo called with indices:', indices, 'Result:', info);
        return info;
    }
}
