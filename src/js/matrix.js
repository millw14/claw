// Matrix Rain Effect
export class MatrixRain {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.chars = 'CLAWCRYPT01アイウエオカキクケコサシスセソ';
        this.charArray = this.chars.split('');
        this.fontSize = 14;
        this.drops = [];
        this.interval = null;
        
        this.init();
        this.setupResize();
    }

    init() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        const columns = Math.floor(this.canvas.width / this.fontSize);
        this.drops = Array(columns).fill(0).map(() => Math.random() * -100);
    }

    setupResize() {
        window.addEventListener('resize', () => this.init());
    }

    draw() {
        this.ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = this.fontSize + 'px monospace';

        for (let i = 0; i < this.drops.length; i++) {
            const char = this.charArray[Math.floor(Math.random() * this.charArray.length)];
            const intensity = Math.random();
            
            this.ctx.fillStyle = intensity > 0.9 ? '#ff0000' : intensity > 0.6 ? '#dc2626' : '#8b0000';
            this.ctx.fillText(char, i * this.fontSize, this.drops[i] * this.fontSize);

            if (this.drops[i] * this.fontSize > this.canvas.height && Math.random() > 0.98) {
                this.drops[i] = 0;
            }
            this.drops[i]++;
        }
    }

    start() {
        this.interval = setInterval(() => this.draw(), 50);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
}
