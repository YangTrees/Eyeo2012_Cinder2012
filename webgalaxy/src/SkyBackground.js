import * as THREE from 'three';

// 天空盒背景 - 使用 background.jpg
export class SkyBackground {
    constructor(scene) {
        this.scene = scene;
        this.create();
    }

    create() {
        const textureLoader = new THREE.TextureLoader();

        // 加载 background.jpg 作为天空盒
        textureLoader.load('/textures/background.jpg', (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            const geometry = new THREE.SphereGeometry(300000, 64, 64);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide,
                transparent: false,
                depthWrite: false,
                fog: false
            });

            this.skySphere = new THREE.Mesh(geometry, material);
            this.skySphere.rotation.x = Math.PI * 75 / 180;  // 75度倾斜
            this.scene.add(this.skySphere);
        }, undefined, (error) => {
            console.error('Failed to load background.jpg');
        });
    }

    update(cameraPos) {
        if (this.skySphere) {
            this.skySphere.position.copy(cameraPos);
        }
    }
}