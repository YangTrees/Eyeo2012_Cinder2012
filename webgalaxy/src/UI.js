// UI 管理
export class UI {
    constructor(app) {
        this.app = app;
        this.infoPanel = document.getElementById('info-panel');
        this.starNameEl = document.getElementById('selected-star-name');
        this.spectrumEl = document.getElementById('selected-star-spectrum');
        this.appMagEl = document.getElementById('selected-star-appmag');
        this.absMagEl = document.getElementById('selected-star-absmag');
        this.distEl = document.getElementById('selected-star-dist');
    }

    showStarInfo(star) {
        if (!star) {
            this.infoPanel.style.display = 'none';
            return;
        }

        this.infoPanel.style.display = 'block';
        this.starNameEl.textContent = star.name || '未命名恒星';
        this.spectrumEl.textContent = star.spectrum || '-';
        this.appMagEl.textContent = star.appMag ? star.appMag.toFixed(2) : '-';
        this.absMagEl.textContent = star.absMag ? star.absMag.toFixed(2) : '-';
        this.distEl.textContent = star.dist ? star.dist.toFixed(2) : '-';
    }

    hideStarInfo() {
        this.infoPanel.style.display = 'none';
    }
}
