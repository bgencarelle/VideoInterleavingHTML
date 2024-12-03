// indexController.js

export class IndexController {
    constructor(maxIndex) {
        this.index = 0;
        this.maxIndex = maxIndex;
        this.direction = 1; // 1 for forward, -1 for backward
        this.listeners = []; // For components that need to be notified of index changes
    }

    setIndex(newIndex) {
        if (newIndex >= 0 && newIndex <= this.maxIndex) {
            this.index = newIndex;
            this.notifyListeners({ indexChanged: true });
        } else {
            console.warn(`Index out of bounds: ${newIndex}`);
        }
    }

    increment() {
        let directionChanged = false;
        this.index += this.direction;

        if (this.index > this.maxIndex) {
            this.index = this.maxIndex;
            this.direction *= -1; // Reverse direction
            directionChanged = true;
        } else if (this.index < 0) {
            this.index = 0;
            this.direction *= -1; // Reverse direction
            directionChanged = true;
        }

        this.notifyListeners({ directionChanged });
    }

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

    onIndexChange(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(event = {}) {
        this.listeners.forEach(callback => callback(this.index, this.direction, event));
    }
}
1