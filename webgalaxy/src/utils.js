import * as THREE from 'three';

// 创建恒星名称精灵 - 精简小字体
export function createStarNameSprite(star) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 200;
    canvas.height = 36;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 恒星名称
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(star.name, 3, 12);

    // 光谱类型
    ctx.fillStyle = 'rgba(200, 210, 255, 0.65)';
    ctx.font = '11px Arial';
    ctx.fillText(star.spectrum || '-', 3, 28);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(50, 10, 1);

    return sprite;
}

export function parsecToLightYears(parsec) {
    return parsec * 3.26156;
}
