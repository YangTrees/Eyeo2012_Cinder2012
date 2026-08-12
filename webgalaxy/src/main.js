import * as THREE from 'three';
import { SpringCamera } from './SpringCamera.js';
import { StarCatalog } from './StarCatalog.js';
import { SkyBackground } from './SkyBackground.js';
import { UI } from './UI.js';

class WebGalaxy {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.power = 0.0;
        this.renderNames = true;
        this.renderBrightStars = true;
        this.renderFaintStars = true;
        this.selectedStar = null;

        // 光晕控制参数
        this.glowMinScale = 1.0;
        this.glowMaxScale = 100.0;

        this.mouse = new THREE.Vector2();
        this.mouseDownPos = new THREE.Vector2();
        this.mousePressed = false;
        this.mouseTimePressed = 0;

        this.initComplete = false;

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        this.camera = new THREE.PerspectiveCamera(65, this.width / this.height, 5, 500000);
        this.camera.position.set(0, 0, 350);

        this.springCam = new SpringCamera(this.camera, 350);
        this.springCam.setTarget(new THREE.Vector3(0, 0, 0));

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        this.ui = new UI(this);

        // 天空盒背景 - 用 background.jpg
        this.skyBackground = new SkyBackground(this.scene);

        // 直接加载恒星数据
        this.loadData();

        this.addEventListeners();
        this.animate();
    }

    async loadData() {
        const loadingEl = document.getElementById('loading');
        const progressBar = document.getElementById('progress-bar');
        const statusEl = document.getElementById('loading-status');

        try {
            this.starCatalog = new StarCatalog(this.scene, this);

            statusEl.textContent = '正在加载恒星数据...';
            progressBar.style.width = '20%';

            await this.starCatalog.loadStarData('/data/starData.txt', (progress) => {
                const percent = 20 + progress * 70;
                progressBar.style.width = `${percent}%`;
                statusEl.textContent = `已加载 ${this.starCatalog.stars.length.toLocaleString()} 颗恒星`;
            });

            progressBar.style.width = '90%';
            statusEl.textContent = '正在初始化渲染...';

            await this.starCatalog.init();
            progressBar.style.width = '100%';

            document.getElementById('star-count-num').textContent =
                this.starCatalog.stars.length.toLocaleString();

            this.initComplete = true;

            setTimeout(() => {
                loadingEl.style.display = 'none';
            }, 500);

        } catch (error) {
            console.error('加载失败:', error);
            statusEl.textContent = '加载失败: ' + error.message;
        }
    }

    addEventListeners() {
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.camera.aspect = this.width / this.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.width, this.height);
        });

        this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => this.onKeyDown(e));

        // 光晕控制
        const glowMinSlider = document.getElementById('glow-min');
        const glowMaxSlider = document.getElementById('glow-max');
        const glowMinVal = document.getElementById('glow-min-val');
        const glowMaxVal = document.getElementById('glow-max-val');

        glowMinSlider.addEventListener('input', (e) => {
            this.glowMinScale = parseFloat(e.target.value);
            glowMinVal.textContent = this.glowMinScale.toFixed(1);
        });

        glowMaxSlider.addEventListener('input', (e) => {
            this.glowMaxScale = parseFloat(e.target.value);
            glowMaxVal.textContent = this.glowMaxScale.toFixed(1);
        });
    }

    onMouseDown(e) {
        this.mouseDownPos.set(e.clientX, e.clientY);
        this.mousePressed = true;
        this.mouseTimePressed = performance.now() / 1000;
    }

    // 修改：移除右键功能
    onMouseUp(e) {
        const mouseTimeReleased = performance.now() / 1000;
        const timeDiff = mouseTimeReleased - this.mouseTimePressed;

        // 只在左键点击且时长 < 0.25s 时才选择恒星
        if (e.button === 0 && timeDiff < 0.25) {
            this.selectStar();
        }

        this.mousePressed = false;
    }

    onMouseMove(e) {
        this.mouse.x = (e.clientX / this.width) * 2 - 1;
        this.mouse.y = -(e.clientY / this.height) * 2 + 1;

        if (this.mousePressed) {
            const offset = new THREE.Vector2(
                e.clientX - this.mouseDownPos.x,
                e.clientY - this.mouseDownPos.y
            );
            this.springCam.drag(offset.x * 0.01, offset.length() * 0.01);
        }
    }

    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        if (this.starCatalog) {
            this.starCatalog.adjustScale(delta);
        }
    }

    onKeyDown(e) {
        if (!this.initComplete) return;

        switch (e.code) {
            case 'Space':
                this.power = this.power > 0.5 ? 0 : 1;
                break;
            case 'KeyN':
                this.renderNames = !this.renderNames;
                this.starCatalog.setRenderNames(this.renderNames);
                break;
            case 'KeyB':
                this.renderBrightStars = !this.renderBrightStars;
                this.starCatalog.setRenderBrightStars(this.renderBrightStars);
                break;
            case 'KeyF':
                this.renderFaintStars = !this.renderFaintStars;
                this.starCatalog.setRenderFaintStars(this.renderFaintStars);
                break;
        }
    }

    // 修改：只显示恒星信息，不飞向
    selectStar() {
        if (!this.initComplete || !this.starCatalog) return;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = raycaster.intersectObjects(this.starCatalog.brightMeshes);

        if (intersects.length > 0) {
            const star = intersects[0].object.userData.star;
            if (this.selectedStar) {
                this.selectedStar.isSelected = false;
            }
            this.selectedStar = star;
            this.selectedStar.isSelected = true;
            // 只显示信息，不飞向
            this.ui.showStarInfo(star);
        }
    }

    update(deltaTime) {
        this.springCam.update(deltaTime);

        if (this.starCatalog) {
            this.starCatalog.update();
        }

        if (this.skyBackground) {
            this.skyBackground.update(this.camera.position);
        }

        if (this.power < 0.9) {
            this.power += deltaTime * 0.2;
        } else {
            this.power += (1.0 - this.power) * 0.05;
        }
        this.power = Math.min(this.power, 1.0);
    }

    animate() {
        const clock = new THREE.Clock();
        const animateLoop = () => {
            requestAnimationFrame(animateLoop);
            const deltaTime = clock.getDelta();
            this.update(deltaTime);
            this.renderer.render(this.scene, this.camera);
        };
        animateLoop();
    }
}

new WebGalaxy();