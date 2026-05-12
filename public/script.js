const urlInput = document.getElementById('url-input');
const fetchBtn = document.getElementById('fetch-btn');
const fetchText = fetchBtn.querySelector('.btn-text');
const fetchSpinner = document.getElementById('fetch-spinner');
const errorMsg = document.getElementById('error-message');

const resultCard = document.getElementById('result-card');
const videoThumbnail = document.getElementById('video-thumbnail');
const videoTitle = document.getElementById('video-title');
const videoChannel = document.getElementById('video-channel');
const videoDuration = document.getElementById('video-duration');

const downloadBtn = document.getElementById('download-btn');
const downloadText = downloadBtn.querySelector('.btn-text');
const downloadSpinner = document.getElementById('download-spinner');

const historyList = document.getElementById('history-list');

let currentUrl = '';

// Load History on Start
document.addEventListener('DOMContentLoaded', updateHistoryUI);

async function grabInfo() {
    const url = urlInput.value.trim();
    if (!url) return;

    // Reset UI
    errorMsg.classList.add('hidden');
    resultCard.classList.add('hidden');
    
    // Loading State
    fetchBtn.disabled = true;
    fetchText.classList.add('hidden');
    fetchSpinner.classList.remove('hidden');

    try {
        const response = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) throw new Error();

        const data = await response.json();
        
        videoThumbnail.src = data.thumbnail;
        videoTitle.textContent = data.title;
        videoChannel.textContent = data.channel;
        videoDuration.textContent = data.duration;
        
        currentUrl = url;
        resultCard.classList.remove('hidden');

        // Save to History
        addToHistory(data.title, url);
        
    } catch (err) {
        errorMsg.classList.remove('hidden');
    } finally {
        fetchBtn.disabled = false;
        fetchText.classList.remove('hidden');
        fetchSpinner.classList.add('hidden');
    }
}

function addToHistory(title, url) {
    let history = JSON.parse(localStorage.getItem('vidsync_history') || '[]');
    // Avoid duplicates
    if (!history.find(item => item.url === url)) {
        history.unshift({ title, url });
        history = history.slice(0, 5); // Keep last 5
        localStorage.setItem('vidsync_history', JSON.stringify(history));
        updateHistoryUI();
    }
}

function updateHistoryUI() {
    const history = JSON.parse(localStorage.getItem('vidsync_history') || '[]');
    historyList.innerHTML = '';
    
    if (history.length === 0) {
        document.getElementById('history-container').classList.add('hidden');
        return;
    }

    document.getElementById('history-container').classList.remove('hidden');
    history.forEach(item => {
        const chip = document.createElement('div');
        chip.className = 'history-chip';
        // Truncate title
        const displayTitle = item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title;
        chip.textContent = displayTitle;
        chip.onclick = () => {
            urlInput.value = item.url;
            grabInfo();
        };
        historyList.appendChild(chip);
    });
}

fetchBtn.addEventListener('click', grabInfo);
urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') grabInfo(); });

downloadBtn.addEventListener('click', () => {
    if (!currentUrl) return;

    downloadText.textContent = "Processing...";
    downloadSpinner.classList.remove('hidden');
    downloadBtn.disabled = true;

    const downloadUrl = `/api/download?url=${encodeURIComponent(currentUrl)}&t=${Date.now()}`;
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = ''; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
        downloadText.textContent = "Download Now";
        downloadSpinner.classList.add('hidden');
        downloadBtn.disabled = false;
    }, 4000);
});
