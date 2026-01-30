// Loading Screen Controller
export class LoadingScreen {
    constructor(options) {
        this.loadingScreen = document.getElementById('loading-screen');
        this.homePage = document.getElementById('home-page');
        this.percentageEl = document.getElementById('percentage');
        this.progressFill = document.getElementById('progress-fill');
        this.crabImage = document.getElementById('crab');
        this.welcomeText = document.getElementById('welcome-text');
        
        // Crab sprite images for animation
        this.crabFrames = [
            '/crab-1.png',
            '/crab-2.png'
        ];
        this.currentFrame = 0;
        this.frameInterval = null;
        
        this.currentPercent = 0;
        this.onComplete = options.onComplete || (() => {});
    }

    startCrabAnimation() {
        // Switch between crab frames faster as loading progresses
        const getFrameDelay = () => {
            // Start at 300ms, go down to 80ms as loading progresses
            return Math.max(80, 300 - (this.currentPercent * 2.2));
        };

        const animateFrame = () => {
            this.currentFrame = (this.currentFrame + 1) % this.crabFrames.length;
            this.crabImage.src = this.crabFrames[this.currentFrame];
            
            // Update glow intensity
            const glow = 30 + (this.currentPercent / 100) * 50;
            this.crabImage.style.filter = `drop-shadow(0 0 ${glow}px rgba(220, 38, 38, ${0.6 + this.currentPercent / 250}))`;
            
            this.frameInterval = setTimeout(animateFrame, getFrameDelay());
        };

        animateFrame();
    }

    stopCrabAnimation() {
        if (this.frameInterval) {
            clearTimeout(this.frameInterval);
            this.frameInterval = null;
        }
        // Reset to first frame
        this.crabImage.src = this.crabFrames[0];
        this.crabImage.style.filter = 'drop-shadow(0 0 40px rgba(220, 38, 38, 0.8))';
    }

    animate() {
        if (this.currentPercent <= 100) {
            this.percentageEl.textContent = this.currentPercent;
            this.progressFill.style.width = this.currentPercent + '%';

            this.currentPercent++;
            setTimeout(() => this.animate(), 30 + Math.random() * 40);
        } else {
            this.complete();
        }
    }

    complete() {
        // Stop crab animation
        this.stopCrabAnimation();
        
        // Show welcome text
        this.welcomeText.classList.add('visible');
        
        // Transition to home page after delay
        setTimeout(() => this.transitionToHome(), 2000);
    }

    transitionToHome() {
        // Hide loading screen
        this.loadingScreen.classList.add('hidden');
        
        // Show home page
        setTimeout(() => {
            this.homePage.classList.add('visible');
            this.onComplete();
        }, 500);
    }

    start() {
        // Start crab animation immediately
        this.startCrabAnimation();
        
        // Start loading after brief delay
        setTimeout(() => this.animate(), 800);
    }
}
