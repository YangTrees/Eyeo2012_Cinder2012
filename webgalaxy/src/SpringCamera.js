import * as THREE from 'three';

// 弹簧阻尼相机 - 视角中心始终在坐标中心
export class SpringCamera {
    constructor(camera, distance) {
        this.camera = camera;
        this.distance = distance;
        this.aspectRatio = window.innerWidth / window.innerHeight;

        // 相机 eye 和 center 保持固定偏移（保证 lookAt 中心）
        this.eye = new THREE.Vector3(0, 0, distance);
        this.center = new THREE.Vector3(0, 0, 0);
        this.up = new THREE.Vector3(0, 1, 0);

        // 偏移量（拖拽旋转时使用）
        this.eyeOffset = new THREE.Vector3();
        this.centerOffset = new THREE.Vector3();

        // 目标
        this.targetCenter = new THREE.Vector3(0, 0, 0);

        // 弹簧参数
        this.springStrength = 0.02;
        this.springDamping = 0.25;

        // 速度
        this.eyeVel = new THREE.Vector3();
        this.centerVel = new THREE.Vector3();

        this.updateCamera();
    }

    setTarget(target) {
        this.targetCenter.copy(target);
    }

    // 拖拽旋转视角 - eye 和 center 同步偏移，视角中心保持稳定
    drag(offsetX, offsetY) {
        // eye 和 center 同步移动，保证 lookAt 关系不变
        this.eyeVel.x += offsetX;
        this.eyeVel.y += offsetY;
        // z 方向上 eye 推离，让相机绕中心旋转
        // 但不要把 z 加到 centerVel
    }

    update(deltaTime) {
        const dt = Math.min(deltaTime, 0.1);

        // 更新 center（飞向目标，弹簧效果）
        const centerDir = this.targetCenter.clone().sub(this.center);
        const springForce = -centerDir.length() * this.springStrength;
        const dampingForce = -this.springDamping * centerDir.dot(this.centerVel);

        const force = springForce + dampingForce;
        const acc = centerDir.normalize().multiplyScalar(force);
        this.centerVel.add(acc.multiplyScalar(dt));

        this.centerVel.multiplyScalar(Math.max(0, 1 - 0.04 * dt));
        this.center.add(this.centerVel.clone().multiplyScalar(dt));

        // 更新 eye（拖拽时跟随 center 偏移，保持视角中心稳定）
        this.eye.add(this.eyeVel.clone().multiplyScalar(dt));
        this.eyeVel.multiplyScalar(Math.max(0, 1 - 0.1 * dt));

        // 应用到相机
        this.camera.position.copy(this.eye);
        this.camera.lookAt(this.center);
        this.camera.up.copy(this.up);
        this.camera.updateProjectionMatrix();
    }

    updateCamera() {
        this.camera.aspect = this.aspectRatio;
        this.camera.updateProjectionMatrix();
    }

    getCam() {
        return this.camera;
    }
}