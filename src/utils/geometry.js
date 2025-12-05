import * as THREE from 'three';

export function createExtrudedGeometry(imgData, thickness = 1.0) {
    const positions = [];
    const colors = [];
    const normals = [];
    const uvs = [];

    const w = imgData.width;
    const h = imgData.height;
    const data = imgData.data;

    // 1 unit size
    const pixelSize = 1.0 / 16.0; 
    const depth = pixelSize * thickness;

    // Helper to push quad
    const pushQ = (v0, v1, v2, v3, nx, ny, nz, r, g, b) => {
        positions.push(...v0, ...v1, ...v2, ...v0, ...v2, ...v3);
        for(let k=0; k<6; k++) {
            normals.push(nx, ny, nz);
            colors.push(r, g, b);
            // Push dummy UVs (0,0) to prevent renderer crashes if attribute is expected
            uvs.push(0, 0);
        }
    };

    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            const i = (y * 16 + x) * 4;
            const a = data[i + 3];
            if (a > 128) {
                const r = data[i] / 255;
                const g = data[i+1] / 255;
                const b = data[i+2] / 255;

                // Position: (x from 0 to 15) -> 0..1
                // Invert Y (Canvas 0 is top)
                const py = (15 - y) * pixelSize - 0.5 + (pixelSize/2);
                const px = x * pixelSize - 0.5 + (pixelSize/2);

                const minX = px - pixelSize/2;
                const maxX = px + pixelSize/2;
                const minY = py - pixelSize/2;
                const maxY = py + pixelSize/2;
                const minZ = -depth/2;
                const maxZ = depth/2;

                // Front
                pushQ([minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ], 0,0,1, r,g,b);
                // Back
                pushQ([maxX, minY, minZ], [minX, minY, minZ], [minX, maxY, minZ], [maxX, maxY, minZ], 0,0,-1, r,g,b);
                // Top
                pushQ([minX, maxY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ], [minX, maxY, minZ], 0,1,0, r,g,b);
                // Bottom
                pushQ([minX, minY, minZ], [maxX, minY, minZ], [maxX, minY, maxZ], [minX, minY, maxZ], 0,-1,0, r,g,b);
                // Right
                pushQ([maxX, minY, maxZ], [maxX, minY, minZ], [maxX, maxY, minZ], [maxX, maxY, maxZ], 1,0,0, r,g,b);
                // Left
                pushQ([minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, maxZ], [minX, maxY, minZ], -1,0,0, r,g,b);
            }
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geo;
}