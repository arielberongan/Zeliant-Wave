class GlobalRadioApp {
    constructor() {
        this.apiKey = 'YOUR_RADIO_BROWSER_API_KEY'; // Optional: Replace with actual API key
        this.baseUrl = 'https://de1.api.radio-browser.info/json';
        this.currentPage = 1;
        this.stationsPerPage = 20;
        this.currentAudio = null;
        this.analyser = null;
        this.canvas = null;
        this.canvasContext = null;

        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Refresh page on logo click
        document.querySelector('.logo h1').addEventListener('click', () => location.reload());

        // Input and filter event listeners
        document.getElementById('countrySearch').addEventListener('input', () => this.loadWithOverlay(() => this.filterStations()));
        document.getElementById('genreFilter').addEventListener('change', () => this.loadWithOverlay(() => this.filterStations()));

        // Pagination buttons
        document.getElementById('prevPage').addEventListener('click', () => this.loadWithOverlay(() => this.changePage(-1)));
        document.getElementById('nextPage').addEventListener('click', () => this.loadWithOverlay(() => this.changePage(1)));

        // Play/Pause button
        document.getElementById('playPauseBtn').addEventListener('click', this.togglePlay.bind(this));
    }

    async fetchRadioStations(query = '', genre = '') {
        this.showLoading(); // Ensure loading overlay is shown before fetching data
        try {
            let url = `${this.baseUrl}/stations/search?limit=${this.stationsPerPage}&offset=${(this.currentPage - 1) * this.stationsPerPage}`;

            if (query) {
                url += `&name=${encodeURIComponent(query)}`; // Search by station name
            }
            if (genre) {
                url += `&tag=${encodeURIComponent(genre)}`; // Filter by genre
            }

            const response = await fetch(url);
            const stations = await response.json();
            this.displayStations(stations);
        } catch (error) {
            console.error('Error fetching radio stations:', error);
        } finally {
            this.hideLoading(); // Hide loading overlay after data is fetched
        }
    }

    displayStations(stations) {
        const container = document.getElementById('stationsContainer');
        container.innerHTML = ''; // Clear previous results

        stations.forEach(station => {
            const card = document.createElement('div');
            card.classList.add('station-card');
            card.innerHTML = `
                <img src="${station.favicon || 'default-station-icon.png'}" alt="${station.name}">
                <div class="station-details">
                    <h3>${station.name}</h3>
                    <p>${station.country} | ${station.language}</p>
                    <button class="play-station" data-url="${station.url}">Play</button>
                </div>
            `;

            // Fallback image if favicon is broken
            const imgElement = card.querySelector('img');
            imgElement.onerror = () => {
                imgElement.src = 'default-station-icon.png'; // Fallback image
            };

            // Play button event listener
            card.querySelector('.play-station').addEventListener('click', () => this.playStation(station));
            container.appendChild(card);
        });

        document.getElementById('currentPage').textContent = `Page ${this.currentPage}`;
    }

    playStation(station) {
        if (this.currentAudio) {
            this.currentAudio.pause();
        }

        // Create new audio context and analyser for visualizer
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = audioContext.createAnalyser();
        this.canvas = document.getElementById('visualizerCanvas');
        this.canvasContext = this.canvas.getContext('2d');

        this.currentAudio = new Audio(station.url);
        this.currentAudio.crossOrigin = "anonymous"; // Necessary for certain audio sources
        this.currentAudio.play();

        // Connect audio source to analyser and audio context
        const source = audioContext.createMediaElementSource(this.currentAudio);
        source.connect(this.analyser);
        this.analyser.connect(audioContext.destination);

        // Update UI with station info
        document.getElementById('currentStation').textContent = station.name;
        document.getElementById('currentLocation').textContent = `${station.country} | ${station.language}`;
        document.getElementById('playPauseBtn').textContent = 'Pause';

        // Start visualizer animation
        this.visualize();
    }

    visualize() {
        if (!this.analyser) return;

        const bufferLength = this.analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);

        const WIDTH = this.canvas.width;
        const HEIGHT = this.canvas.height;

        const renderFrame = () => {
            requestAnimationFrame(renderFrame);

            this.analyser.getByteTimeDomainData(dataArray);

            // Clear canvas
            this.canvasContext.fillStyle = 'black';
            this.canvasContext.fillRect(0, 0, WIDTH, HEIGHT);

            // Draw waveform
            this.canvasContext.lineWidth = 2;
            this.canvasContext.strokeStyle = 'rgb(0, 255, 0)';
            this.canvasContext.beginPath();

            const sliceWidth = WIDTH / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * HEIGHT) / 2;

                if (i === 0) {
                    this.canvasContext.moveTo(x, y);
                } else {
                    this.canvasContext.lineTo(x, y);
                }

                x += sliceWidth;
            }

            this.canvasContext.lineTo(WIDTH, HEIGHT / 2);
            this.canvasContext.stroke();
        };

        renderFrame();
    }

    togglePlay() {
        if (this.currentAudio) {
            if (this.currentAudio.paused) {
                this.currentAudio.play();
                document.getElementById('playPauseBtn').textContent = 'Pause';
            } else {
                this.currentAudio.pause();
                document.getElementById('playPauseBtn').textContent = 'Play';
            }
        }
    }

    changePage(direction) {
        this.currentPage += direction;
        if (this.currentPage < 1) this.currentPage = 1;

        // Load next page with the overlay showing
        this.loadWithOverlay(() => this.fetchRadioStations(
            document.getElementById('countrySearch').value,
            document.getElementById('genreFilter').value
        ));
    }

    filterStations() {
        this.currentPage = 1; // Reset to page 1 for new search
        this.loadWithOverlay(() => this.fetchRadioStations(
            document.getElementById('countrySearch').value,
            document.getElementById('genreFilter').value
        ));
    }

    showLoading() {
        // Ensure loading overlay is shown
        this.loadingOverlay.classList.add('active');
    }

    hideLoading() {
        // Ensure loading overlay is hidden once data is fetched
        this.loadingOverlay.classList.remove('active');
    }

    async loadWithOverlay(callback) {
        this.showLoading(); // Show loading overlay immediately
        await callback(); // Wait for the search or page change operation to complete
        this.hideLoading(); // Hide loading overlay after the callback completes
    }

    init() {
        this.fetchRadioStations(); // Load initial stations
    }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const radioApp = new GlobalRadioApp();
    radioApp.init();
});
