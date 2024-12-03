let imageCache = new Map();

export async function fetchJSON(path) {
    try {
        let response = await fetch(path);
        if (!response.ok) throw Error(`Failed to load ${path}: ${response.statusText}`);
        let data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
        return { folders: [] };
    }
}

export async function loadImage(path) {
    return new Promise((resolve) => {
        if (imageCache.has(path)) {
            resolve(imageCache.get(path));
            return;
        }
        let encodedPath = encodeURI(path);
        let img = new Image();
        img.src = encodedPath;
        img.onload = () => {
            imageCache.set(path, img);
            resolve(img);
        };
        img.onerror = () => {
            console.error(`Failed to load image: ${path}`);
            resolve(null);
        };
    });
}
