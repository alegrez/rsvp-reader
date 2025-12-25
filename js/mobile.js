let words = [];
let currentIndex = 0;
let isPlaying = false;
let timerOut = null;
let isContextOpen = false;
let currentWpm = 300;
let lastTapTime = 0;
let tapCount = 0;
let tapTimeout = null;
let currentMode = 'text';
let currentBookMeta = null;
let currentBookTitle = "Unknown Title";
let currentBookAuthor = "";

const inputText = document.getElementById('inputText');
const wordOutput = document.getElementById('wordOutput');
const btnToggle = document.getElementById('btnToggle');
const btnReset = document.getElementById('btnReset');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnContext = document.getElementById('btnContext');
const readerDisplay = document.getElementById('reader-display');
const toast = document.getElementById('toast');
const contextOverlay = document.getElementById('context-overlay');
const wpmDisplay = document.getElementById('wpmDisplay');
const fsWpmDisplay = document.getElementById('fsWpmDisplay');
const btnFsExit = document.getElementById('btnFsExit');
const btnFsContext = document.getElementById('btnFsContext');
const feedbackLeft = document.getElementById('feedbackLeft');
const feedbackRight = document.getElementById('feedbackRight');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const epubInput = document.getElementById('epubInput');
const chapterSelect = document.getElementById('chapterSelect');
const epubControls = document.getElementById('epub-controls');
const btnPrevChapter = document.getElementById('btnPrevChapter');
const btnNextChapter = document.getElementById('btnNextChapter');
const btnSyncPhrase = document.getElementById('btnSyncPhrase');
const bookMetadata = document.getElementById('book-metadata');

const resumeCard = document.getElementById('resume-card');
const uploadCard = document.getElementById('upload-card');
const resumeTitle = document.getElementById('resume-title');
const resumeInfo = document.getElementById('resume-info');
const btnResume = document.getElementById('btnResume');
const btnDeleteBook = document.getElementById('btnDeleteBook');

window.addEventListener('DOMContentLoaded', async () => { 
    renderWord("Ready", wordOutput); 
    EpubBridge.init();

    const settings = StorageService.getSettings();
    if(settings.wpm) {
        currentWpm = settings.wpm;
    }
    updateDisplays();
    
    await checkSavedBook();
});

async function checkSavedBook() {
    const meta = await StorageService.getProgress();
    if (meta && meta.title) {
        currentBookMeta = meta;
        currentBookTitle = meta.title;
        currentBookAuthor = meta.author;

        resumeCard.style.display = 'block';
        uploadCard.style.display = 'none';
        
        resumeTitle.textContent = meta.title;
        resumeInfo.textContent = "Progress saved"; 
    } else {
        resumeCard.style.display = 'none';
        uploadCard.style.display = 'block';
    }
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-content-${btn.dataset.target}`).classList.add('active');
        currentMode = btn.dataset.target;
        resetReader();
    });
});


btnResume.addEventListener('click', async () => {
    const fileBlob = await StorageService.loadBookFile();
    if (fileBlob) {
        showToast("Loading from storage...", toast);
        EpubBridge.loadBook(fileBlob);
    } else {
        alert("Error: Book file not found.");
        resetBookData();
    }
});

btnDeleteBook.addEventListener('click', async () => {
    if(confirm("Remove this book?")) {
        await resetBookData();
    }
});

async function resetBookData() {
    await StorageService.clearBookData();
    location.reload();
}


epubInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        showToast("Saving...", toast);
        await StorageService.saveBookFile(file);

        const reader = new FileReader();
        reader.onload = (e) => EpubBridge.loadBook(e.target.result);
        reader.readAsArrayBuffer(file);
    }
});

EpubBridge.onMetadataReady = (title, author) => {
    currentBookTitle = title || "Unknown Title";
    currentBookAuthor = author || "";

    bookMetadata.textContent = `${currentBookTitle}`;
    bookMetadata.style.display = 'block';
    
    if (!currentBookMeta) {
        saveCurrentState();
    }
};

document.addEventListener('epubChaptersLoaded', (e) => {
    const chapters = e.detail;
    chapterSelect.innerHTML = "";
    chapters.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.href;
        opt.textContent = ch.label;
        chapterSelect.appendChild(opt);
    });

    if (currentBookMeta && currentBookMeta.chapterHref) {
        chapterSelect.value = currentBookMeta.chapterHref;
        EpubBridge.loadChapter(currentBookMeta.chapterHref);
    } else {
        if(chapters.length > 0) EpubBridge.loadChapter(chapters[0].href);
    }

    resumeCard.style.display = 'none';
    uploadCard.style.display = 'none';
    epubControls.style.display = 'flex';
});

chapterSelect.addEventListener('change', (e) => {
    pauseReader();
    EpubBridge.loadChapter(e.target.value);
});

EpubBridge.onChapterReady = (htmlContent) => {
    words = parseHTMLToRSVP(htmlContent);
    
    if (currentBookMeta && currentBookMeta.wordIndex > 0) {
        currentIndex = Math.min(words.length - 1, currentBookMeta.wordIndex);
        showToast(`Resumed at word ${currentIndex}`, toast);
        currentBookMeta = null;
    } else {
        currentIndex = 0;
        showToast("Chapter Loaded", toast);
    }

    if (words.length > 0) {
        renderWord(words[currentIndex], wordOutput);
    } else {
        renderWord("Empty", wordOutput);
        alert("This chapter seems empty. Try another one.");
    }
};

function saveCurrentState() {
    if (currentMode === 'epub' && EpubBridge.book) {
        const href = chapterSelect.value;
        StorageService.saveProgress(currentBookTitle, currentBookAuthor, href, currentIndex);
    }
    StorageService.saveSettings(currentWpm, currentMode);
}

window.addEventListener('beforeunload', () => {
    saveCurrentState();
});

btnPrevChapter.addEventListener('click', () => {
    const prev = EpubBridge.getPreviousChapter();
    if (prev) {
        chapterSelect.value = prev;
        EpubBridge.loadChapter(prev);
    }
});

btnNextChapter.addEventListener('click', () => {
    const next = EpubBridge.getNextChapter();
    if (next) {
        chapterSelect.value = next;
        EpubBridge.loadChapter(next);
    }
});

btnSyncPhrase.addEventListener('click', () => {
    const phrase = prompt("Find phrase (3+ words):");
    if (phrase) {
        const idx = EpubBridge.findPhraseIndex(words, phrase);
        if (idx !== -1) {
            currentIndex = idx;
            renderWord(words[currentIndex], wordOutput);
            showToast("Synced!", toast);
        } else {
            alert("Not found in chapter.");
        }
    }
});

function initData() {
    if (currentMode === 'epub') {
        if (words.length > 0) return true;
        alert("Load an EPUB first.");
        return false;
    }
    const rawText = inputText.value.trim();
    if (!rawText) { alert("Please enter some text."); return false; }
    words = parseContent(rawText);
    return true;
}

window.changeSpeedGlobal = function(delta) {
    currentWpm += delta;
    if (currentWpm < 60) currentWpm = 60;
    if (currentWpm > 1200) currentWpm = 1200;
    updateDisplays();
    showToast(`${currentWpm} WPM`, toast);
}

function updateDisplays() {
    wpmDisplay.textContent = currentWpm;
    fsWpmDisplay.textContent = currentWpm;
}

function startReader() {
    if (words.length === 0) { if (!initData()) return; }
    if (currentIndex >= words.length) currentIndex = 0;
    isPlaying = true; btnToggle.textContent = "Pause";
    if (isContextOpen) toggleContextView();
    loopReader();
}

function loopReader() {
    if (!isPlaying) return;
    if (currentIndex >= words.length) { 
        pauseReader(); 
        currentIndex = 0; 
        return; 
    }

    const currentWordObj = words[currentIndex];
    renderWord(currentWordObj, wordOutput);

    const baseDelay = 60000 / currentWpm;
    let finalDelay = baseDelay;

    if (currentWordObj.type === 'break') {
        finalDelay = baseDelay * 4.5;
    } else {
        const text = currentWordObj.text;
        const lastChar = text.slice(-1);
        if (',;'.includes(lastChar)) finalDelay = baseDelay * 2.0; 
        else if ('.?!:”。'.includes(lastChar)) finalDelay = baseDelay * 3.2;
        else if (text.length > 10) finalDelay = baseDelay * 1.2;
    }

    currentIndex++;
    timerOut = setTimeout(loopReader, finalDelay);
}

function pauseReader() {
    isPlaying = false; 
    clearTimeout(timerOut); 
    btnToggle.textContent = "Continue";
    saveCurrentState();
}

function togglePlayPause() {
    if (isContextOpen) { toggleContextView(); startReader(); }
    else { isPlaying ? pauseReader() : startReader(); }
}

function resetReader() {
    pauseReader(); currentIndex = 0; 
    if (currentMode === 'text') words = []; 
    btnToggle.textContent = "Start"; renderWord("Ready", wordOutput);
}

function flashFeedback(side) {
    const el = side === 'left' ? feedbackLeft : feedbackRight;
    el.classList.add('active'); setTimeout(() => el.classList.remove('active'), 300);
}

function skipWords(direction) {
    if (words.length === 0) return;
    const jumpSize = Math.max(5, Math.floor((currentWpm / 60) * 3));
    const delta = direction === 'left' ? -jumpSize : jumpSize;
    currentIndex = Math.max(0, Math.min(words.length - 1, currentIndex + delta));
    renderWord(words[currentIndex], wordOutput);
    showToast(direction === 'left' ? `⏪ -${jumpSize}` : `⏩ +${jumpSize}`, toast);
    flashFeedback(direction);
}

function skipParagraphPrev() {
    if (words.length === 0) return;
    let newIndex = Math.max(0, currentIndex - 2);
    while (newIndex > 0 && words[newIndex].type !== 'break') newIndex--;
    if (words[newIndex].type === 'break') newIndex++;
    
    currentIndex = newIndex;
    renderWord(words[currentIndex], wordOutput);
    showToast("⏮ Paragraph Start", toast);
    flashFeedback('left');
}

readerDisplay.addEventListener('touchend', (e) => {
    if (e.target.closest('#mobile-fs-toolbar') || e.target.tagName === 'BUTTON' || e.target.closest('#context-overlay')) return;

    const now = Date.now();
    const rect = readerDisplay.getBoundingClientRect();
    const x = e.changedTouches[0].clientX - rect.left;
    const y = e.changedTouches[0].clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    let zone = 'center';
    if (x < width * 0.25) zone = 'left';
    else if (x > width * 0.75) zone = 'right';

    if (zone === 'center') {
        const yRatio = y / height;
        if (yRatio < 0.25 || yRatio > 0.75) return; 
    }

    if (now - lastTapTime < 400) tapCount++;
    else tapCount = 1;
    lastTapTime = now;

    clearTimeout(tapTimeout);

    if (tapCount === 1) {
        tapTimeout = setTimeout(() => {
            if (zone === 'center') togglePlayPause();
            tapCount = 0;
        }, 400);
    } else if (tapCount === 2) {
        if (zone === 'left') skipWords('left');
        else if (zone === 'right') skipWords('right');
        else togglePlayPause();
    } else if (tapCount === 3) {
        if (zone === 'left') { skipParagraphPrev(); tapCount = 0; }
    }
    e.preventDefault();
});

async function toggleFullscreen() {
    if (!document.fullscreenElement) {
        try {
            await readerDisplay.requestFullscreen();
            document.body.classList.add('fullscreen-active');
            if (screen.orientation && screen.orientation.lock) {
                try { await screen.orientation.lock('landscape'); } catch (e) { console.warn(e); }
            }
        } catch (err) { alert("Error: " + err.message); }
    } else {
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
        document.exitFullscreen();
        document.body.classList.remove('fullscreen-active');
    }
}
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        document.body.classList.remove('fullscreen-active');
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    }
});

btnFullscreen.addEventListener('click', toggleFullscreen);
btnFsExit.addEventListener('click', toggleFullscreen);

function toggleContextView() {
    if (words.length === 0 && !initData()) return;
    isContextOpen = !isContextOpen;
    
    if (isContextOpen) {
        pauseReader();
        contextOverlay.innerHTML = '<button class="close-ctx-btn">Close X</button>';
        contextOverlay.querySelector('.close-ctx-btn').onclick = toggleContextView;
        
        words.forEach((wordObj, index) => {
            if (wordObj.type === 'break') { 
                contextOverlay.appendChild(document.createElement('div')).className = 'ctx-break'; 
            } else {
                const span = document.createElement('span'); 
                span.textContent = wordObj.text + " "; 
                span.className = 'ctx-word';
                
                if (wordObj.bold) span.style.fontWeight = 'bold';
                if (wordObj.italic) span.style.fontStyle = 'italic';
                if (wordObj.header) { 
                    span.style.fontWeight = 'bold'; 
                    span.style.color = '#2a9d8f';
                    span.style.display = 'inline-block';
                    if (wordObj.headerLevel === 1) { 
                        span.style.fontSize = '1.6em'; span.style.color = '#e76f51'; span.style.marginTop = '10px';
                    } else if (wordObj.headerLevel === 2) {
                        span.style.fontSize = '1.3em'; span.style.marginTop = '8px';
                    }
                }

                if (index > 0 && index - 1 === currentIndex) {
                    span.classList.add('current'); 
                    setTimeout(() => span.scrollIntoView({block: "center"}), 50);
                }
                span.onclick = () => { 
                    currentIndex = index; renderWord(words[currentIndex], wordOutput); 
                    toggleContextView(); 
                };
                contextOverlay.appendChild(span);
            }
        });
        contextOverlay.classList.add('active');
    } else {
        contextOverlay.classList.remove('active');
    }
}

btnToggle.addEventListener('click', togglePlayPause);
btnReset.addEventListener('click', resetReader);
btnContext.addEventListener('click', toggleContextView);
btnFsContext.addEventListener('click', toggleContextView);
