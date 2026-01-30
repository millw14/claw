// Home Page Controller
export class HomePage {
    constructor() {
        this.leftPrompts = [
            "Track this wallet",
            "Who bought early?",
            "Find diamond hands",
            "Show whale activity",
            "Alert on buys",
            "Find snipers"
        ];
        
        this.rightPrompts = [
            "Show top holders",
            "Is this bullish?",
            "Explain this wallet",
            "Compare wallets",
            "Find similar ones",
            "Check PnL"
        ];
        
        this.rotateInterval = null;
        this.leftIndex = 0;
        this.rightIndex = 0;
    }

    startBubbleRotation() {
        // Rotate one bubble at a time, alternating sides
        this.rotateInterval = setInterval(() => this.rotateSingleBubble(), 5000);
    }

    rotateSingleBubble() {
        const leftBubbles = document.querySelectorAll('.chat-bubble.left:not(:has(.typing-dots))');
        const rightBubbles = document.querySelectorAll('.chat-bubble.right:not(:has(.typing-dots))');
        
        // Alternate between left and right
        if (Math.random() > 0.5 && leftBubbles.length > 0) {
            const bubble = leftBubbles[Math.floor(Math.random() * leftBubbles.length)];
            const prompt = this.leftPrompts[this.leftIndex % this.leftPrompts.length];
            this.leftIndex++;
            bubble.innerHTML = `<span class="bubble-icon">></span> ${prompt}`;
        } else if (rightBubbles.length > 0) {
            const bubble = rightBubbles[Math.floor(Math.random() * rightBubbles.length)];
            const prompt = this.rightPrompts[this.rightIndex % this.rightPrompts.length];
            this.rightIndex++;
            bubble.innerHTML = `${prompt}<span class="bubble-icon">></span>`;
        }
    }

    stopBubbleRotation() {
        if (this.rotateInterval) {
            clearInterval(this.rotateInterval);
        }
    }

    enterChat() {
        window.location.href = '/pages/chat.html';
    }

    init() {
        // Setup enter button
        const enterBtn = document.querySelector('.enter-btn');
        if (enterBtn) {
            enterBtn.addEventListener('click', () => this.enterChat());
        }

        // Start bubble rotation
        this.startBubbleRotation();
    }
}
