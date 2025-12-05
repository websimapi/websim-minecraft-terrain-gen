import * as THREE from 'three';

const ATLAS_SIZE = 512;
const TILE_SIZE = 16;
const TILES_PER_ROW = 32;
const UV_SIZE = 1 / TILES_PER_ROW;

export const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = ATLAS_SIZE;
atlasCanvas.height = ATLAS_SIZE;
export const atlasCtx = atlasCanvas.getContext('2d');
atlasCtx.imageSmoothingEnabled = false;

export const textureMap = new Map();
export const rawImages = new Map(); // Store raw images for high-res UI icons
const pixelCache = new Map(); // Cache for pixel data to avoid slow readbacks
let nextSlot = 0;

// Animated Textures Registry
const animatedTextures = [];

export const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
atlasTexture.colorSpace = THREE.SRGBColorSpace;
atlasTexture.magFilter = THREE.NearestFilter;
atlasTexture.minFilter = THREE.NearestMipmapLinearFilter;
atlasTexture.generateMipmaps = true;

// Event listeners for texture loading
const textureLoadListeners = new Set();

export function onTextureLoaded(callback) {
    textureLoadListeners.add(callback);
}

export const ATLAS_MAT_SOLID = new THREE.MeshBasicMaterial({ 
    map: atlasTexture, 
    vertexColors: true,
    side: THREE.FrontSide
});

export const ATLAS_MAT_ALPHA_TEST = new THREE.MeshBasicMaterial({ 
    map: atlasTexture, 
    vertexColors: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide
});

export const ATLAS_MAT_TRANS = new THREE.MeshBasicMaterial({ 
    map: atlasTexture, 
    vertexColors: true,
    transparent: true, 
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false
});

export function updateTextureAtlas(delta) {
    let updated = false;
    for (const anim of animatedTextures) {
        anim.timer += delta;
        // 10fps animation speed (approx 0.1s) for better fluid feel
        if (anim.timer > 0.1) { 
            anim.timer = 0;
            anim.currentFrame = (anim.currentFrame + 1) % anim.frames;
            
            const col = anim.slot % TILES_PER_ROW;
            const row = Math.floor(anim.slot / TILES_PER_ROW);
            
            // Clear the slot
            atlasCtx.clearRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            
            // Draw the specific frame
            // Source Y = currentFrame * width (since frames are square stacked vertically)
            const frameSize = anim.image.width; // Should be 16
            
            atlasCtx.drawImage(
                anim.image, 
                0, anim.currentFrame * frameSize, frameSize, frameSize, 
                col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE
            );
            
            if (anim.tint) {
                atlasCtx.save();
                atlasCtx.globalCompositeOperation = 'multiply';
                atlasCtx.fillStyle = anim.tint;
                atlasCtx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                atlasCtx.restore();
            }
            
            updated = true;
        }
    }
    
    if (updated) {
        atlasTexture.needsUpdate = true;
    }
}

export function registerAtlasTexture(name, path, tint = null) {
    const slot = nextSlot++;
    textureMap.set(name, slot);
    const img = new Image();
    rawImages.set(name, img); // Store reference
    img.onload = () => {
        const col = slot % TILES_PER_ROW;
        const row = Math.floor(slot / TILES_PER_ROW);
        
        const frameSize = img.width;
        // Check for vertical spritesheet (Height >= Width and multiple)
        const frames = Math.floor(img.height / frameSize);

        if (frames > 1 && img.height % frameSize === 0) {
            // Draw first frame initially
            atlasCtx.drawImage(img, 0, 0, frameSize, frameSize, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            
            // Register animation
            animatedTextures.push({
                slot,
                image: img,
                frames,
                currentFrame: 0,
                timer: 0,
                tint
            });
        } else {
            // Standard single texture - Draw full to fit tile
            atlasCtx.drawImage(img, 0, 0, img.width, img.height, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
        
        // Initial processing (alpha fixing, etc - mostly for single frame or first frame)
        const imageData = atlasCtx.getImageData(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        const data = imageData.data;
        let hasBlack = false;
        for(let i = 0; i < data.length; i += 4) {
            if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) {
                data[i + 3] = 0; // Transparent
                hasBlack = true;
            }
        }
        if (hasBlack) {
            atlasCtx.putImageData(imageData, col * TILE_SIZE, row * TILE_SIZE);
        }
        
        // Cache the image data immediately
        pixelCache.set(name, imageData);
        
        if (tint) {
            atlasCtx.save();
            atlasCtx.globalCompositeOperation = 'multiply';
            atlasCtx.fillStyle = tint;
            atlasCtx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            atlasCtx.restore();
        }
        
        atlasTexture.needsUpdate = true;
        
        // Notify listeners
        for (const callback of textureLoadListeners) {
            try { callback(); } catch(e) { console.error(e); }
        }
    };
    img.onerror = (e) => {
        console.error(`Failed to load texture: ${name} at ${path}`, e);
    };
    // Encode path to handle spaces/special chars in filenames safely
    const safePath = path.split('/').map(part => encodeURIComponent(part)).join('/');
    // Fix: encodeURIComponent encodes too much (like dots), usually browser handles it, 
    // but specific chars like spaces ' ' might be issues if not handled.
    // Simplest fix is just encoding the filename part or using encodeURI if path is full.
    // However, given the local context './file (1).png', we should be careful.
    // Let's just rely on encodeURI which skips ./ characters but fixes spaces.
    img.src = encodeURI(path);
}

export function getAtlasUV(name) {
    const slot = textureMap.has(name) ? textureMap.get(name) : 0;
    const col = slot % TILES_PER_ROW;
    const row = Math.floor(slot / TILES_PER_ROW);
    const u = col * UV_SIZE;
    const v = 1 - (row + 1) * UV_SIZE;
    return { u, v, w: UV_SIZE, h: UV_SIZE, row, col };
}

export function getBlockImagePixels(name) {
    if (pixelCache.has(name)) return pixelCache.get(name);
    // Fallback (slow, should not happen often if registered correctly)
    const slot = textureMap.has(name) ? textureMap.get(name) : 0;
    const col = slot % TILES_PER_ROW;
    const row = Math.floor(slot / TILES_PER_ROW);
    return atlasCtx.getImageData(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
}

export function setTextureFiltering(useLinear) {
    const mag = useLinear ? THREE.LinearFilter : THREE.NearestFilter;
    // Keep minFilter as MipmapLinear to ensure distant chunks are solid average colors
    const min = useLinear ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapLinearFilter;
    
    atlasTexture.magFilter = mag;
    atlasTexture.minFilter = min;
    atlasTexture.needsUpdate = true;
}

