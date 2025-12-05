import * as THREE from 'three';

export class CloudLayer {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        
        // Configuration for "WAYYYYYY more big"
        this.res = 16; // Even lower res for optimization
        this.cloudSize = 100; // Even bigger clouds
        this.cloudHeight = 5; 
        this.worldSize = this.res * this.cloudSize; 
        
        this.enabled = true; 

        const loader = new THREE.ImageLoader();
        loader.load('./clouds (1).png', (image) => {
            const canvas = document.createElement('canvas');
            canvas.width = this.res;
            canvas.height = this.res;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, this.res, this.res);
            
            const imgData = ctx.getImageData(0, 0, this.res, this.res);
            const data = imgData.data;
            
            let totalB = 0;
            for(let i=0; i<data.length; i+=4) totalB += data[i];
            const invert = (totalB / (data.length / 4)) > 128;

            const positions = [];
            
            // Reduced repeat grid to 2x2 to optimize draw calls, rely on fog to hide edges
            const repeat = 2; 
            
            for(let u = 0; u < repeat; u++) {
                for(let v = 0; v < repeat; v++) {
                    for(let x = 0; x < this.res; x++) {
                        for(let z = 0; z < this.res; z++) {
                            const i = (x + z * this.res) * 4;
                            let val = data[i];
                            if (invert) val = 255 - val;
                            
                            // Higher threshold = fewer clouds
                            if (val > 120) { 
                                positions.push({
                                    x: (x + u * this.res) * this.cloudSize,
                                    z: (z + v * this.res) * this.cloudSize
                                });
                            }
                        }
                    }
                }
            }

            const geometry = new THREE.BoxGeometry(this.cloudSize, this.cloudHeight, this.cloudSize);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                opacity: 0.8,
                transparent: true,
                fog: true
            });
            
            this.mesh = new THREE.InstancedMesh(geometry, material, positions.length);
            this.mesh.userData.isCloud = true;
            this.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
            
            const dummy = new THREE.Object3D();
            for(let i=0; i < positions.length; i++) {
                dummy.position.set(positions[i].x, 250, positions[i].z); 
                dummy.updateMatrix();
                this.mesh.setMatrixAt(i, dummy.matrix);
            }
            
            this.mesh.instanceMatrix.needsUpdate = true;
            this.group.add(this.mesh);
        });
    }

    setColor(r, g, b) {
        if (this.mesh && this.mesh.material) {
            this.mesh.material.color.setRGB(r, g, b);
        }
    }

    setVisible(visible) {
        this.group.visible = visible;
    }

    update(time, playerPos) {
        if (!this.mesh || this.worldSize === 0) return;

        const speed = 25.0; // Movement speed
        
        // Calculate scrolling offset
        const scrollX = (time * speed) % this.worldSize;
        const scrollZ = (time * speed * 0.2) % this.worldSize;

        // Snap to grid centered on player
        // We use floor to snap to the grid size (worldSize)
        // We subtract worldSize to keep the 3x3 grid centered (0..3W -> -W..2W)
        const snapX = Math.floor(playerPos.x / this.worldSize) * this.worldSize;
        const snapZ = Math.floor(playerPos.z / this.worldSize) * this.worldSize;
        
        this.group.position.x = snapX + scrollX - this.worldSize;
        this.group.position.z = snapZ + scrollZ - this.worldSize;
    }
}