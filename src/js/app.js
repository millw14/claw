// Main Application Entry Point
import { MatrixRain } from './matrix.js';
import { LoadingScreen } from './loading.js';
import { HomePage } from './home.js';

class App {
    constructor() {
        this.matrix = null;
        this.loading = null;
        this.home = null;
    }

    init() {
        // Initialize Matrix Rain
        this.matrix = new MatrixRain('matrix-canvas');
        this.matrix.start();

        // Initialize Home Page Controller
        this.home = new HomePage();

        // Initialize Loading Screen
        this.loading = new LoadingScreen({
            onComplete: () => {
                // Initialize home page when loading completes
                this.home.init();
            }
        });

        // Start loading
        this.loading.start();
    }
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
