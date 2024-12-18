import { startAnimation } from './animation.js';
import { IPS, BUFFER_SIZE, MAX_CONCURRENT_FETCHES, PINGPONG_MODE} from './config.js';
import { ImageCache } from './imageCache.js';
import { IndexController } from './indexController.js';
import { FolderController } from './folderController.js';
import { showModeOverlay, addKeyboardListeners, addFullscreenToggle, fetchPreloadedJSON, preloadJSON} from './utils.js';


(async function initializeApp() {
    try {
        await preloadJSON();


        const mainData = fetchPreloadedJSON('main');
        const floatData = fetchPreloadedJSON('float');

        const maxIndex = mainData.folders[0].image_list.length;
        const indexController = new IndexController(IPS,PINGPONG_MODE);
        const folderController = new FolderController(mainData.folders, floatData.folders);


        indexController.initialize(maxIndex);
        console.log(`IndexController initialized with cycleLength: ${indexController.cycleLength}`);

        const cycleLength = indexController.cycleLength;
        const imageCache = new ImageCache(BUFFER_SIZE, {
            maxConcurrency: MAX_CONCURRENT_FETCHES,
            cycleLength,
            indexController,
            folderController,
            mainFolders: mainData.folders,
            floatFolders: floatData.folders,
        });

        await imageCache.preloadImages(indexController.getCurrentFrameNumber());

        startAnimation(indexController, imageCache);

        const imageContainer = document.getElementById('image-container');
        addFullscreenToggle(imageContainer); // Attach fullscreen toggle
        addKeyboardListeners(indexController, showModeOverlay); // Attach keyboard listeners

    } catch (error) {
        console.error('Error during initialization:', error);
    }
})();
