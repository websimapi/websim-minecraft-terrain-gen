import * as THREE from 'three';

export function setupSkybox(scene, sceneMenu) {
    const cubeLoader = new THREE.CubeTextureLoader();
    try {
        const skyboxTexture = cubeLoader.load([
            './Right.png',
            './Left.png',
            './Up.png',
            './Bottom.png',
            './Front.png',
            './Back.png'
        ]);
        sceneMenu.background = skyboxTexture;
        return skyboxTexture;
    } catch (e) {
        console.warn("Skybox failed to load", e);
        scene.background = new THREE.Color(0x87CEEB);
        sceneMenu.background = new THREE.Color(0x111111);
        return null;
    }
}

export function setupRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.autoClear = false;
    return renderer;
}

export function loadBreakTextures() {
    const breakTextures = [];
    const texLoader = new THREE.TextureLoader();
    for(let i=0; i<=9; i++) {
        const t = texLoader.load(`./destroy_stage_${i}.png`);
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        breakTextures.push(t);
    }
    return breakTextures;
}

export function createSelectionBox(scene) {
    const boxGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const selectionBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
    selectionBox.visible = false;
    scene.add(selectionBox);
    return selectionBox;
}

export function createBreakMesh(scene, breakTextures) {
    const breakMat = new THREE.MeshBasicMaterial({ 
        map: breakTextures[0], 
        transparent: true, 
        depthTest: true, 
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1, 
        side: THREE.FrontSide,
        color: 0x888888
    });
    const breakMesh = new THREE.Mesh(new THREE.BoxGeometry(1.005, 1.005, 1.005), breakMat);
    breakMesh.visible = false;
    scene.add(breakMesh);
    return { breakMesh, breakMat };
}