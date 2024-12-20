// config.js

export const FPS = 61; // Frames Per Second for canvas
export const IPS = 30; //Index Updates Per Second
export const FRAME_DURATION = 1000 / FPS;
export const INDEX_UPDATE_DURATION = 1000 / IPS;
export const BUFFER_SIZE = 5; // Example: buffer size equals one second of frames
export const MAX_CONCURRENT_FETCHES = 3; // Maximum number of concurrent image preloads
export const PINGPONG_MODE = true;
export const MAIN_IMAGES_JSON = 'generated_img_lists/main_images.json';
export const FLOAT_IMAGES_JSON = 'generated_img_lists/float_images.json';
export const USE_HTTP = true;