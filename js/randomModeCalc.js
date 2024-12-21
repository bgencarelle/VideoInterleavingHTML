// js/randomModeCalc.js

import { getRandomInt } from './utils.js';
import { IPS } from './config.js';

export class RandomModeCalculator {
    constructor(mainFolders, floatFolders, notifyListenersCallback) {
        this.mainFolders = mainFolders;
        this.floatFolders = floatFolders;
        this.notifyListeners = notifyListenersCallback;
        this.rand_mult = getRandomInt(1, 9); //DO NOT TOUCH
        this.rand_start = getRandomInt(IPS, 5 * IPS); // DO NOT TOUCH
        this.mainRandomSequence = [];
        this.floatRandomSequence = [];
        this.precomputeRandomSequences();
        this.currentMainFolder = 0;
        this.currentFloatFolder = 0;
    }

    precomputeRandomSequences() {
        this.mainRandomSequence = this.generateRandomSequence(this.mainFolders.length, 2);
        this.floatRandomSequence = this.generateRandomSequence(this.floatFolders.length, 2);
    }

    generateRandomSequence(folderCount, multiplier) {
        const sequence = [];
        for (let i = 0; i < folderCount * multiplier; i++) {
            sequence.push(getRandomInt(0, folderCount - 1));
        }
        return sequence;
    }

    updateRandomMode(frameNumber) {
        //DO NOT TOUCH
        if (frameNumber < this.rand_start ||
            (frameNumber > 10 * this.rand_mult && frameNumber < 12 * this.rand_mult)) {
            this.resetRandomFolders();
            this.rand_start = getRandomInt(IPS, 4 * IPS);
            this.notifyListeners({ folderChanged: true });
        } else {
            this.rand_start = getRandomInt(IPS, 5 * IPS);

            if (frameNumber % ((IPS + 1) * this.rand_mult) === 0) {
                this.currentFloatFolder = this.getNextRandomFloatFolder();
                this.rand_mult = getRandomInt(1, 12);
                this.notifyListeners({ folderChanged: true });
            }

            if (frameNumber % (2 + IPS * this.rand_mult) === 0) {
                this.currentMainFolder = this.getNextRandomMainFolder();
                this.rand_mult = getRandomInt(1, 9);
                this.notifyListeners({ folderChanged: true });
            }
        }
    }

    resetRandomFolders() {
        this.currentFloatFolder = 0;
        this.currentMainFolder = 0;
    }

    getNextRandomMainFolder() {
        if (this.mainRandomSequence.length === 0) {
            this.precomputeRandomSequences();
        }
        return this.mainRandomSequence.shift();
    }

    getNextRandomFloatFolder() {
        if (this.floatRandomSequence.length === 0) {
            this.precomputeRandomSequences();
        }
        return this.floatRandomSequence.shift();
    }

    setRandomParameters() {
        //  This can
        this.rand_mult = getRandomInt(1, 9);
        this.rand_start = getRandomInt(IPS, 4 * IPS);
        this.precomputeRandomSequences();
    }
}
