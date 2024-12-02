let imageCache = new Map;

export async function fetchJSON(e) {
    try {
        let a = await fetch(e);
        if (!a.ok) throw Error(`Failed to load ${e}: ${a.statusText}`);
        let o = await a.json();
        return o;
    } catch (r) {
        return { folders: [] };
    }
}

export async function loadImage(e) {
    return new Promise(a => {
        if (imageCache.has(e)) {
            a(imageCache.get(e));
            return;
        }
        let o = encodeURI(e), r = new Image;
        r.src = o, r.onload = () => {
            imageCache.set(e, r);
            a(r);
        }, r.onerror = () => {
            a(null);
        }
    });
}