import * as THREE from 'three';

export class MilkyWay {
    constructor(scene, onLoadComplete) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.onLoadComplete = onLoadComplete;
        this.create();
    }

    create() {
        // 原版：用 milkyWay.jpg 作为球体贴图，半径 195000，倾斜 75 度
        const geometry = new THREE.SphereGeometry(195000, 32, 32);

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            '/textures/milkyWay.jpg',
            (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = true;

                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.BackSide,
                    transparent: true,
                    opacity: 0.25
                });

                this.milkyWaySphere = new THREE.Mesh(geometry, material);
                this.milkyWaySphere.rotation.x = Math.PI * 75 / 180;
                this.group.add(this.milkyWaySphere);

                if (this.onLoadComplete) this.onLoadComplete();
            },
            undefined,
            (error) => {
                console.error('Failed to load milkyWay.jpg');
                this.createFallbackMilkyWay();
                if (this.onLoadComplete) this.onLoadComplete();
            }
        );

        this.scene.add(this.group);
    }

    createFallbackMilkyWay() {
        const galaxyGeometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];

        const numStars = 50000;
        for (let i = 0; i < numStars; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.pow(Math.random(), 0.5) * 195000;
            const height = (Math.random() - 0.5) * 10000;

            const x = radius * Math.cos(angle);
            const y = height;
            const z = radius * Math.sin(angle);

            positions.push(x, y, z);

            const distRatio = radius / 195000;
            const brightness = 0.2 + Math.random() * 0.3;
            const r = brightness * (1.0 - distRatio * 0.2);
            const g = brightness * (1.0 - distRatio * 0.1);
            const b = brightness;
            colors.push(r, g, b);
        }

        galaxyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        galaxyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const galaxyMaterial = new THREE.PointsMaterial({
            size: 100,
            vertexColors: true,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });

        this.milkyWaySphere = new THREE.Points(galaxyGeometry, galaxyMaterial);
        this.milkyWaySphere.rotation.x = Math.PI * 75 / 180;
        this.group.add(this.milkyWaySphere);
    }

    update(cameraPos, power) {
        // 原版：背景跟着相机移动，但保持缩放
        this.group.position.copy(cameraPos);

        if (this.milkyWaySphere && this.milkyWaySphere.material) {
            // 根据 power 控制银河可见度
            this.milkyWaySphere.material.opacity = 0.25 * power;
        }
    }
}