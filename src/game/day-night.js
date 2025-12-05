import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class DayNightCycle {
    constructor(dirLight, scene, clouds) {
        this.dirLight = dirLight;
        this.scene = scene;
        this.clouds = clouds;
        
        this.dayTime = 0;
        this.dayDuration = CONFIG.DAY_DURATION;
        
        this.SKY_COLOR_DAY = new THREE.Color(CONFIG.SKY_COLOR_DAY);
        this.SKY_COLOR_NIGHT = new THREE.Color(CONFIG.SKY_COLOR_NIGHT);
        this.SUN_COLOR = new THREE.Color(CONFIG.SUN_COLOR);
        this.MOON_COLOR = new THREE.Color(CONFIG.MOON_COLOR);
        this.RAIN_COLOR = new THREE.Color(0x444455);
        this.SUNSET_COLOR = new THREE.Color(0xffaa44); // Orange/Red
        
        this.dimension = 'overworld';
        this.NETHER_SKY = new THREE.Color(0x300505);
        this.NETHER_LIGHT = new THREE.Color(0x502020);

        this.weather = 'clear'; // clear, rain
        this.rainIntensity = 0; // 0 to 1
        this.rainSystem = null;
        this.snowSystem = null;

        this.initVisuals();
        this.initRain();
        this.initSnow();
    }

    initVisuals() {
        this.celestialGroup = new THREE.Group();
        this.scene.add(this.celestialGroup);

        const loader = new THREE.TextureLoader();

        // Sky Sphere (Gradient)
        const skyGeo = new THREE.SphereGeometry(450, 32, 16);
        // Invert sphere to view from inside
        skyGeo.scale(-1, 1, 1);
        
        this.skyUniforms = {
            topColor: { value: new THREE.Color(0x88AAFF) },
            bottomColor: { value: new THREE.Color(0xffffff) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        };

        const skyMat = new THREE.ShaderMaterial({
            uniforms: this.skyUniforms,
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize( vWorldPosition + offset ).y;
                    gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
                }
            `,
            side: THREE.BackSide,
            depthWrite: false
        });

        this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
        this.skyMesh.renderOrder = -1; // Render first
        this.celestialGroup.add(this.skyMesh);

        // Sun
        const sunTex = loader.load('./sun.png');
        sunTex.colorSpace = THREE.SRGBColorSpace;
        sunTex.magFilter = THREE.NearestFilter; // Fix blur
        sunTex.minFilter = THREE.NearestFilter;
        const sunMat = new THREE.MeshBasicMaterial({ 
            map: sunTex, 
            transparent: true, 
            side: THREE.DoubleSide,
            fog: false,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), sunMat);
        this.sunMesh.position.set(0, 100, 0); 
        this.celestialGroup.add(this.sunMesh);

        // Moon
        const moonTex = loader.load('./moon_phases.png');
        moonTex.colorSpace = THREE.SRGBColorSpace;
        moonTex.magFilter = THREE.NearestFilter;
        moonTex.minFilter = THREE.NearestFilter;
        moonTex.repeat.set(0.25, 0.5); // 4x2 grid
        moonTex.offset.set(0, 0.5); // Top left (Full Moon)
        const moonMat = new THREE.MeshBasicMaterial({ 
            map: moonTex, 
            transparent: true, 
            side: THREE.DoubleSide,
            fog: false,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), moonMat);
        this.moonMesh.position.set(0, -100, 0); 
        this.celestialGroup.add(this.moonMesh);
    }

    initRain() {
        // Simple rain system attached to camera
        const geometry = new THREE.BufferGeometry();
        const count = 2000;
        const positions = new Float32Array(count * 3);
        
        for(let i=0; i<count; i++) {
            positions[i*3] = (Math.random() - 0.5) * 40;
            positions[i*3+1] = (Math.random() - 0.5) * 30;
            positions[i*3+2] = (Math.random() - 0.5) * 40;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const loader = new THREE.TextureLoader();
        const rainTex = loader.load('./rain.png'); // Need asset, or simple line
        
        const material = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.5,
            map: rainTex,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
            fog: true
        });
        
        this.rainSystem = new THREE.Points(geometry, material);
        this.rainSystem.visible = false;
        this.scene.add(this.rainSystem);
    }

    initSnow() {
        const geometry = new THREE.BufferGeometry();
        const count = 3000;
        const positions = new Float32Array(count * 3);
        
        for(let i=0; i<count; i++) {
            positions[i*3] = (Math.random() - 0.5) * 50;
            positions[i*3+1] = (Math.random() - 0.5) * 40;
            positions[i*3+2] = (Math.random() - 0.5) * 50;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const loader = new THREE.TextureLoader();
        const snowTex = loader.load('./snow.png'); 
        
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.3,
            map: snowTex,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            fog: true
        });
        
        this.snowSystem = new THREE.Points(geometry, material);
        this.snowSystem.visible = false;
        this.scene.add(this.snowSystem);
    }

    setDimension(dim) {
        this.dimension = dim;
        this.weather = 'clear';
        this.rainIntensity = 0;
    }
    
    setWeather(type) {
        if (this.dimension === 'nether') return;
        this.weather = type;
    }

    update(delta, isPaused, camera, biomeTemp = 0.5) {
        if (this.dimension === 'nether') {
            this.dirLight.color.copy(this.NETHER_LIGHT);
            this.dirLight.intensity = 0.5;
            if (this.clouds) this.clouds.setVisible(false);
            if (this.rainSystem) this.rainSystem.visible = false;
            if (this.snowSystem) this.snowSystem.visible = false;
            
            if (camera) {
                this.dirLight.position.set(camera.position.x, camera.position.y + 100, camera.position.z);
                this.dirLight.target.position.copy(camera.position);
            }
            return { sunHeight: 0.5, skyColor: this.NETHER_SKY };
        }

        if (this.clouds && this.clouds.enabled) this.clouds.setVisible(true);

        if (!isPaused) {
            this.dayTime += delta;
        }
        
        // Weather transition
        const targetRain = (this.weather === 'rain') ? 1.0 : 0.0;
        this.rainIntensity = THREE.MathUtils.lerp(this.rainIntensity, targetRain, delta * 0.5);
        
        const dayProgress = (this.dayTime % this.dayDuration) / this.dayDuration;
        const theta = dayProgress * Math.PI * 2;
        const sunHeight = Math.sin(theta);
        const sunX = Math.cos(theta);
        
        let skyColor = this.SKY_COLOR_DAY.clone();
        let lightColor = this.SUN_COLOR.clone();
        let lightIntensity = 1.5;

        // Night transition
        if (sunHeight < -0.1) {
            skyColor = this.SKY_COLOR_NIGHT.clone();
            lightColor = this.MOON_COLOR.clone();
            lightIntensity = 0.05;
        } else if (sunHeight < 0.1) {
            const t = (sunHeight + 0.1) / 0.2;
            skyColor.lerp(this.SKY_COLOR_NIGHT, 1 - t);
            lightColor.lerp(this.MOON_COLOR, 1 - t);
            lightIntensity = 0.05 + (1.45 * t);
        }
        
        // Rain modifications
        if (this.rainIntensity > 0.01) {
            skyColor.lerp(this.RAIN_COLOR, this.rainIntensity * 0.8);
            lightIntensity *= (1.0 - this.rainIntensity * 0.5);
            
            // Render rain
            this.rainSystem.visible = true;
            this.rainSystem.material.opacity = this.rainIntensity * 0.6;
            
            if (camera) {
                this.rainSystem.position.copy(camera.position);
                // Animate drop fall
                const positions = this.rainSystem.geometry.attributes.position.array;
                for(let i=1; i<positions.length; i+=3) {
                    positions[i] -= 20 * delta;
                    if (positions[i] < -15) positions[i] += 30;
                }
                this.rainSystem.geometry.attributes.position.needsUpdate = true;
            }
        } else {
            this.rainSystem.visible = false;
        }
        
        this.dirLight.color.copy(lightColor);
        this.dirLight.intensity = lightIntensity;
        
        if (this.clouds) {
            let cloudColor = lightColor.clone().lerp(new THREE.Color(0xffffff), 0.5);
            if (sunHeight < 0) cloudColor.multiplyScalar(0.2);
            if (this.rainIntensity > 0) cloudColor.multiplyScalar(1.0 - this.rainIntensity * 0.5); // Darker clouds
            this.clouds.setColor(cloudColor.r, cloudColor.g, cloudColor.b);
        }
        
        // Celestial Body Positioning
        // Rotate around Z axis (East-West)
        // At progress 0 (Sunrise), sun should be at X+, rising.
        // progress 0.25 (Noon), sun at Y+.
        
        // Current logic: sin(theta) is Y. cos(theta) is X.
        // theta 0 -> Y=0, X=1 (Horizon East)
        // theta PI/2 -> Y=1, X=0 (Zenith)
        
        const dist = 400;
        this.sunMesh.position.set(sunX * dist, sunHeight * dist, 0);
        this.moonMesh.position.set(-sunX * dist, -sunHeight * dist, 0); // Opposite
        
        this.sunMesh.lookAt(camera.position);
        this.moonMesh.lookAt(camera.position);
        
        if (camera) {
            this.celestialGroup.position.copy(camera.position);
            
            this.dirLight.position.set(
                camera.position.x + sunX * 100,
                camera.position.y + sunHeight * 100,
                camera.position.z + 20
            );
            this.dirLight.target.position.copy(camera.position);
            this.dirLight.target.updateMatrixWorld();
        }

        return { sunHeight, skyColor };
    }

    setTime(val) {
        if (val === 'day') {
            this.dayTime = 0; // Sunrise
        } else if (val === 'night') {
            this.dayTime = this.dayDuration * 0.5; // Sunset
        } else if (!isNaN(parseInt(val))) {
            this.dayTime = parseInt(val);
        }
    }
}

