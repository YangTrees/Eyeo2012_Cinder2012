import * as THREE from 'three';

export class StarCatalog {
    constructor(scene, app) {
        this.scene = scene;
        this.app = app;

        this.stars = [];
        this.brightStars = [];
        this.faintStars = [];
        this.namedStars = [];

        this.scale = 0.2;
        this.scaleDest = 0.2;
        this.maxScale = 400.0;

        this.renderBrightStars = true;
        this.renderFaintStars = true;
        this.renderNames = true;

        this.textures = {};
        this.startTime = Date.now();
        this.spectrumCanvas = null;
    }

    async loadTextures() {
        const textureLoader = new THREE.TextureLoader();

        const load = (name, path) => {
            return new Promise((resolve) => {
                textureLoader.load(path, (tex) => {
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    tex.generateMipmaps = true;
                    this.textures[name] = tex;
                    resolve();
                });
            });
        };

        await Promise.all([
            load('star', '/textures/star.png'),
            load('darkStar', '/textures/darkStar.png'),
            load('starGlow', '/textures/starGlow.png'),
            load('nova', '/textures/nova.png'),
            load('sparkle', '/textures/sparkle.png'),
            load('particle', '/textures/particle.png'),
            load('sun', '/textures/sun.png'),
            load('spectrum', '/textures/spectrum.png')
        ]);
    }

    async loadStarData(url, onProgress) {
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.split('\n');

        const total = lines.length;
        let processed = 0;

        for (const line of lines) {
            if (!line.trim()) continue;

            const star = this.parseStarLine(line);
            if (star) {
                this.stars.push(star);
                if (star.appMag < 6.0 || star.name.length > 1) {
                    this.brightStars.push(star);
                } else {
                    this.faintStars.push(star);
                }
                if (star.name.length > 1) {
                    this.namedStars.push(star);
                }
            }

            processed++;
            if (processed % 10000 === 0 && onProgress) {
                onProgress(processed / total);
            }
        }

        if (onProgress) onProgress(1);
        console.log(`Loaded ${this.stars.length} stars`);
    }

    parseStarLine(line) {
        const parts = line.split(',');
        if (parts.length < 9) return null;

        const [index, name, ra, dec, dist, appMag, absMag, spectrum, colIndex] = parts;

        if (!dist || dist === '0' || isNaN(parseFloat(dist))) return null;

        const raRad = (parseFloat(ra) * 15.0) * Math.PI / 180;
        const decRad = parseFloat(dec) * Math.PI / 180;
        const distance = parseFloat(dist);

        const x = distance * Math.cos(decRad) * Math.cos(raRad);
        const y = distance * Math.cos(decRad) * Math.sin(raRad);
        const z = distance * Math.sin(decRad);

        return {
            index: parseInt(index),
            name: name ? name.trim() : '',
            position: new THREE.Vector3(x, y, z),
            ra: parseFloat(ra),
            dec: parseFloat(dec),
            dist: distance * 3.26156,
            appMag: parseFloat(appMag),
            absMag: parseFloat(absMag),
            spectrum: spectrum ? spectrum.trim() : '',
            colorIndex: parseFloat(colIndex) || 0,
            isSelected: false
        };
    }

    spectrumToIndex(spectrum, colIndex) {
        if (colIndex > 0 && colIndex <= 1.0) {
            return colIndex;
        }
        if (!spectrum || spectrum === ' ') return 0.5;

        const type = spectrum.charAt(0).toUpperCase();
        const colors = { 'O': 0.0, 'B': 0.166, 'A': 0.2, 'F': 0.5, 'G': 0.666, 'K': 0.833, 'M': 1.0 };
        return colors[type] !== undefined ? colors[type] : 0.5;
    }

    async init() {
        await this.loadTextures();
        this.createFaintStars();
        this.createBrightStars();
        this.createStarNames();
    }

    // 暗星 - 用 Points + Shader
    createFaintStars() {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];

        for (const star of this.faintStars) {
            const scaledPos = star.position.clone().multiplyScalar(this.scale);
            positions.push(scaledPos.x, scaledPos.y, scaledPos.z);
            const specIdx = this.spectrumToIndex(star.spectrum, star.colorIndex);
            colors.push(specIdx, 0, 0);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                spectrumTex: { value: this.textures.spectrum },
                power: { value: 0.0 },
                time: { value: 0.0 },
                scale: { value: this.scale }
            },
            vertexShader: `
                attribute vec3 color;
                varying vec4 vColor;
                void main() {
                    vColor = vec4(color, 1.0);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = 1.5 * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D spectrumTex;
                uniform float power;
                uniform float time;
                varying vec4 vColor;

                float rand(vec2 co) {
                    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
                }

                void main() {
                    vec3 spectrumCol = texture2D(spectrumTex, vec2(vColor.r, 0.5)).rgb;
                    float noise = rand(vec2(gl_FragCoord.xy) + time);
                    float alpha = 0.3 + noise * 0.4;
                    vec3 color = spectrumCol * alpha;

                    // 圆形点
                    float d = length(gl_PointCoord - 0.5);
                    if (d > 0.5) discard;
                    color *= (1.0 - d * 2.0);

                    gl_FragColor = vec4(color, alpha * (1.0 - d * 2.0));
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true
        });

        this.faintMesh = new THREE.Points(geometry, material);
        this.scene.add(this.faintMesh);
    }

    // 亮星 - 根据类型选择纹理，根据绝对星等控制大小
    createBrightStars() {
        this.brightGroup = new THREE.Group();
        this.brightMeshes = [];

        for (const star of this.brightStars) {
            const starColor = this.getStarColor(star);

            // 根据绝对星等计算大小
            const radius = (10 - star.absMag) * 0.025;
            const scaledPos = star.position.clone().multiplyScalar(this.scale);

            // 根据绝对星等选择纹理
            let texture;
            if (star.absMag < -2) {
                texture = this.textures.sun || this.textures.star;  // 极亮的用 sun
            } else if (star.absMag < 0) {
                texture = this.textures.nova || this.textures.star;
            } else if (star.absMag < 3) {
                texture = this.textures.sparkle || this.textures.star;
            } else {
                texture = this.textures.particle || this.textures.star;
            }

            // 主精灵
            const material = new THREE.SpriteMaterial({
                map: texture,
                color: starColor,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            const sprite = new THREE.Sprite(material);
            sprite.position.copy(scaledPos);
            // sprite 大小 - 根据绝对星等
            sprite.scale.setScalar(Math.max(radius * 10, 1.5));
            sprite.userData.star = star;
            sprite.userData.isGlow = false;

            this.brightGroup.add(sprite);
            this.brightMeshes.push(sprite);

            // 光晕（绝对星等 < 2）
            if (star.absMag < 2 && this.textures.starGlow) {
                const glowMaterial = new THREE.SpriteMaterial({
                    map: this.textures.starGlow,
                    color: starColor,
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    opacity: 0.2
                });

                const glow = new THREE.Sprite(glowMaterial);
                glow.position.copy(scaledPos);
                // 光晕基础大小
                glow.scale.setScalar(Math.max(radius * 25, 3.0));
                glow.userData.star = star;
                glow.userData.isGlow = true;
                glow.userData.baseGlowScale = Math.max(radius * 25, 3.0);

                this.brightGroup.add(glow);
            }
        }

        this.scene.add(this.brightGroup);
    }

    // 根据 colIndex 和 spectrum 返回颜色（高饱和度彩色过渡）
    getStarColor(star) {
        // 优先用 colIndex 在 spectrum 纹理上插值（彩色渐变）
        if (star.colorIndex > 0 && star.colorIndex <= 1.0) {
            const t = star.colorIndex;
            // 蓝 -> 青 -> 绿 -> 黄 -> 橙 -> 红 渐变
            if (t < 0.16) {
                // O 型：深蓝
                return new THREE.Color(0.3, 0.5, 1.0);
            } else if (t < 0.25) {
                // B 型：蓝白
                const localT = (t - 0.16) / 0.09;
                return new THREE.Color(0.4 + localT * 0.4, 0.6 + localT * 0.3, 1.0);
            } else if (t < 0.5) {
                // A 型：白到浅黄
                const localT = (t - 0.25) / 0.25;
                return new THREE.Color(0.8 + localT * 0.2, 0.9 + localT * 0.1, 1.0 - localT * 0.1);
            } else if (t < 0.7) {
                // F-G 型：黄色
                const localT = (t - 0.5) / 0.2;
                return new THREE.Color(1.0, 0.95 - localT * 0.05, 0.9 - localT * 0.3);
            } else if (t < 0.85) {
                // K 型：橙色
                const localT = (t - 0.7) / 0.15;
                return new THREE.Color(1.0, 0.9 - localT * 0.2, 0.6 - localT * 0.3);
            } else {
                // M 型：红色
                const localT = (t - 0.85) / 0.15;
                return new THREE.Color(1.0, 0.7 - localT * 0.3, 0.3 - localT * 0.2);
            }
        }

        // fallback：使用光谱类型映射
        const spectralColors = {
            'O': new THREE.Color(0.3, 0.5, 1.0),
            'B': new THREE.Color(0.5, 0.7, 1.0),
            'A': new THREE.Color(0.85, 0.92, 1.0),
            'F': new THREE.Color(1.0, 0.98, 0.85),
            'G': new THREE.Color(1.0, 0.95, 0.7),
            'K': new THREE.Color(1.0, 0.75, 0.4),
            'M': new THREE.Color(1.0, 0.5, 0.25)
        };

        if (star.spectrum) {
            const type = star.spectrum.charAt(0).toUpperCase();
            return spectralColors[type] || new THREE.Color(1, 1, 1);
        }
        return new THREE.Color(1, 1, 1);
    }

    createStarNames() {
        this.nameGroup = new THREE.Group();
        this.nameSprites = [];

        for (const star of this.namedStars) {
            if (star.appMag >= 6.0) continue;

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 64;

            ctx.clearRect(0, 0, 256, 64);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(star.name, 4, 4);

            ctx.fillStyle = 'rgba(200, 210, 255, 0.7)';
            ctx.font = '16px Arial';
            ctx.fillText(star.spectrum || '-', 4, 30);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;

            const material = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false
            });

            const sprite = new THREE.Sprite(material);
            sprite.position.copy(star.position.clone().multiplyScalar(this.scale));
            sprite.position.x += 12;
            sprite.scale.set(40, 10, 1);
            sprite.userData.star = star;

            this.nameGroup.add(sprite);
            this.nameSprites.push(sprite);
        }

        this.scene.add(this.nameGroup);
    }

    update() {
        this.scale += (this.scaleDest - this.scale) * 0.02;

        const cameraPos = this.app.springCam.camera.position;
        const time = (Date.now() - this.startTime) * 0.001;

        if (this.brightGroup) {
            for (const sprite of this.brightGroup.children) {
                const star = sprite.userData.star;
                if (star) {
                    const scaledPos = star.position.clone().multiplyScalar(this.scale);
                    sprite.position.copy(scaledPos);

                    // 光晕范围随相机距离调整 - 距离越近光晕越小
                    if (sprite.userData.isGlow) {
                        const dist = cameraPos.distanceTo(scaledPos);

                        // 获取界面调节的最大最小阈值（绝对像素大小）
                        const glowMin = this.app.glowMinScale || 1.0;
                        const glowMax = this.app.glowMaxScale || 100.0;

                        // 光晕与距离成正比：pixel = dist * factor
                        // 距离 < refDist (100) 时缩放到 glowMin
                        // 距离 > maxDist (1000) 时缩放到 glowMax
                        const refDist = 100;
                        const maxDist = 1000;
                        const factor = 0.05;  // 每单位距离对应 0.05 像素

                        // 计算基于距离的光晕大小
                        const distBasedScale = dist * factor;

                        // 限制在 glowMin ~ glowMax 之间
                        const glowScale = Math.min(glowMax, Math.max(glowMin, distBasedScale));

                        // 加上基础星等缩放（基于半径基础值）
                        const radiusFactor = sprite.userData.baseGlowScale || 1.0;
                        sprite.scale.setScalar(Math.max(glowScale * radiusFactor * 0.3, glowMin));
                    }
                }
            }
        }

        if (this.nameGroup) {
            for (const sprite of this.nameSprites) {
                const star = sprite.userData.star;
                if (star) {
                    const scaledPos = star.position.clone().multiplyScalar(this.scale);
                    sprite.position.copy(scaledPos);
                    sprite.position.x += 12;

                    const dist = cameraPos.distanceTo(scaledPos);
                    let opacity = Math.max(0, 1 - dist * 0.0000375);
                    opacity = Math.pow(opacity, 3);

                    if (star.isSelected) opacity = 1.0;

                    sprite.material.opacity = Math.max(0.05, opacity) * 0.8;
                }
            }
            this.nameGroup.visible = this.renderNames;
        }

        if (this.faintMesh && this.faintMesh.material.uniforms) {
            this.faintMesh.material.uniforms.scale.value = this.scale;
            this.faintMesh.material.uniforms.time.value = time;
            this.faintMesh.material.uniforms.power.value = this.app.power;
        }
    }

    adjustScale(delta) {
        this.scaleDest -= delta * 0.05;
        this.scaleDest = Math.max(0.2, Math.min(this.maxScale, this.scaleDest));
    }

    setRenderBrightStars(show) {
        if (this.brightGroup) this.brightGroup.visible = show;
    }

    setRenderFaintStars(show) {
        if (this.faintMesh) this.faintMesh.visible = show;
    }

    setRenderNames(show) {
        this.renderNames = show;
        if (this.nameGroup) this.nameGroup.visible = show;
    }
}