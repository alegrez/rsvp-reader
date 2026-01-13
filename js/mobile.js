let currentWpm = 300;
let lastTapTime = 0;
let tapCount = 0;
let tapTimeout = null;
let currentMode = 'text';
let currentBookId = null;
let currentBookTitle = "Unknown Title";
let currentBookAuthor = "";
let isContextOpen = false;
let isResetting = false;

const inputText = document.getElementById('inputText');
const wordOutput = document.getElementById('wordOutput');
const btnToggle = document.getElementById('btnToggle');
const btnReset = document.getElementById('btnReset');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnContext = document.getElementById('btnContext');
const readerDisplay = document.getElementById('reader-display');
const toast = document.getElementById('toast');
const contextOverlay = document.getElementById('context-overlay');
const progressIndicator = document.getElementById('progress-indicator');
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
const btnOpenLibrary = document.getElementById('btnOpenLibrary');
const btnUploadNew = document.getElementById('btnUploadNew');

const btnSettings = document.getElementById('btnSettings');
const settingsOverlay = document.getElementById('settings-overlay');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const fontSelect = document.getElementById('fontSelect');
const weightSelect = document.getElementById('weightSelect');
const themeSelect = document.getElementById('themeSelect');
const btnFactoryReset = document.getElementById('btnFactoryReset');

const libraryOverlay = document.getElementById('library-overlay');
const btnCloseLibrary = document.getElementById('btnCloseLibrary');
const libraryList = document.getElementById('library-list');
const btnUploadFromLib = document.getElementById('btnUploadFromLib');
const btnLibraryFromControls = document.getElementById('btnLibraryFromControls');

const fontConfig = {
    'classic': { family: "'Courier New', Courier, monospace", weights: [400, 700] },
    'opendyslexic': { family: '"OpenDyslexic", "Comic Sans MS", sans-serif', weights: [400, 700] },
    'system': { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', weights: [300, 400, 500, 700] },
    'mono': { family: '"Roboto Mono", monospace', weights: [300, 400, 500, 700] },
    'serif': { family: '"Merriweather", serif', weights: [300, 400, 700, 900] }
};

const weightLabels = { 300: "Light", 400: "Normal", 500: "Medium", 700: "Bold", 900: "Black" };

ReaderEngine.init({
    getWpm: () => currentWpm,
    renderWord: (wordObj) => renderWord(wordObj, wordOutput),
    renderProgress: (text) => { if (progressIndicator) progressIndicator.textContent = text; },
    onStateChange: (playing) => {
        btnToggle.textContent = playing ? "Pause" : "Start";
        if (playing) saveCurrentState();
    },
    onFinish: () => saveCurrentState()
});

function updateWeightDropdown(fontKey, preferredWeight) {
    if (!weightSelect) return;
    const config = fontConfig[fontKey] || fontConfig['classic'];
    const validWeights = config.weights;
    weightSelect.innerHTML = '';
    validWeights.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w;
        opt.textContent = `${weightLabels[w] || w} (${w})`;
        weightSelect.appendChild(opt);
    });
    if (validWeights.includes(parseInt(preferredWeight))) {
        weightSelect.value = preferredWeight;
    } else if (validWeights.includes(400)) {
        weightSelect.value = 400;
    } else {
        weightSelect.value = validWeights[0];
    }
    weightSelect.disabled = validWeights.length < 2;
}

function applySettings(settings) {
    const fontKey = settings.font || 'classic';
    const savedWeight = settings.fontWeight || '400';
    const theme = settings.theme || 'light';

    const metaThemeColor = document.querySelector("meta[name=theme-color]");
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        if(metaThemeColor) metaThemeColor.setAttribute("content", "#121212");
    } else {
        document.body.classList.remove('dark-mode');
        if(metaThemeColor) metaThemeColor.setAttribute("content", "#264653");
    }
    if (themeSelect) themeSelect.value = theme;

    updateWeightDropdown(fontKey, savedWeight);
    const finalWeight = weightSelect ? weightSelect.value : savedWeight;
    const fontFamily = fontConfig[fontKey].family;
    
    document.documentElement.style.setProperty('--font-family', fontFamily);
    document.documentElement.style.setProperty('--font-weight', finalWeight);
    if (fontSelect) fontSelect.value = fontKey;
}

window.addEventListener('DOMContentLoaded', async () => { 
    renderWord("Ready", wordOutput); 
    EpubBridge.init();
    
    const settings = StorageService.getSettings();
    if(settings.wpm) currentWpm = parseInt(settings.wpm);
    if (settings.progressMode !== undefined) ReaderEngine.progressMode = settings.progressMode;
    
    updateDisplays();
    applySettings(settings);
    ReaderEngine.updateProgress();
    
    await checkLastReadBook();
});

async function checkLastReadBook() {
    const book = await StorageService.getLastReadBook();
    if (book) {
        currentBookId = book.id;
        currentBookTitle = book.title;
        currentBookAuthor = book.author;
        resumeCard.style.display = 'block';
        uploadCard.style.display = 'none';
        resumeTitle.textContent = book.title;
        resumeInfo.textContent = "Progress saved"; 
    } else {
        resumeCard.style.display = 'none';
        uploadCard.style.display = 'block';
    }
}

async function renderLibraryList() {
    const books = await StorageService.getLibrary();
    libraryList.innerHTML = "";
    if (books.length === 0) {
        libraryList.innerHTML = '<div class="empty-lib-msg">No books yet. Upload one!</div>';
        return;
    }
    books.forEach(book => {
        const item = document.createElement('div');
        item.className = 'library-item';
        const date = new Date(book.lastRead).toLocaleDateString();
        item.innerHTML = `
            <div class="lib-info">
                <h4 class="lib-title">${book.title}</h4>
                <p class="lib-author">${book.author}</p>
                <div class="lib-meta">Last read: ${date}</div>
            </div>
            <div class="lib-actions">
                <button class="btn-lib-open" data-id="${book.id}">Open</button>
                <button class="btn-lib-del" data-id="${book.id}">🗑</button>
            </div>
        `;
        libraryList.appendChild(item);
    });
    libraryList.querySelectorAll('.btn-lib-open').forEach(btn => btn.onclick = () => loadBookFromLibrary(btn.dataset.id));
    libraryList.querySelectorAll('.btn-lib-del').forEach(btn => btn.onclick = () => deleteBookFromLibrary(btn.dataset.id));
}

async function loadBookFromLibrary(bookId) {
    libraryOverlay.classList.remove('active');
    const fileBlob = await StorageService.loadBookFile(bookId);
    if (fileBlob) {
        currentBookId = bookId;
        showToast("Loading book...", toast);
        EpubBridge.loadBook(fileBlob);
    } else {
        alert("Error loading book data.");
    }
}

async function deleteBookFromLibrary(bookId) {
    if(confirm("Delete this book?")) {
        await StorageService.deleteBook(bookId);
        await renderLibraryList();
        if (currentBookId === bookId) {
            currentBookId = null;
            checkLastReadBook();
            ReaderEngine.reset();
            ReaderEngine.loadContent([]);
            renderWord("Ready", wordOutput);
            bookMetadata.style.display = 'none';
            epubControls.style.display = 'none';
        }
    }
}

btnResume.addEventListener('click', async () => { if (currentBookId) loadBookFromLibrary(currentBookId); });
btnOpenLibrary.addEventListener('click', () => { renderLibraryList(); libraryOverlay.classList.add('active'); });
if (btnLibraryFromControls) {
    btnLibraryFromControls.addEventListener('click', () => {
        ReaderEngine.pause();
        renderLibraryList();
        libraryOverlay.classList.add('active');
    });
}
btnUploadNew.addEventListener('click', () => { resumeCard.style.display = 'none'; uploadCard.style.display = 'block'; });
btnCloseLibrary.addEventListener('click', () => libraryOverlay.classList.remove('active'));
btnUploadFromLib.addEventListener('click', () => {
    libraryOverlay.classList.remove('active');
    resumeCard.style.display = 'none';
    uploadCard.style.display = 'block';
    document.querySelector('.tab-btn[data-target="epub"]').click();
});

if(btnSettings) {
    btnSettings.addEventListener('click', () => {
        settingsOverlay.classList.add('active');
        if(ReaderEngine.isPlaying) ReaderEngine.pause();
    });
}
function closeSettings() { settingsOverlay.classList.remove('active'); }
if(btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettings);
if(btnSaveSettings) btnSaveSettings.addEventListener('click', closeSettings);

if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        const currentFont = fontSelect ? fontSelect.value : 'classic';
        const currentWeight = weightSelect ? weightSelect.value : '400';
        StorageService.saveSettings(currentWpm, currentMode, currentFont, currentWeight, newTheme, ReaderEngine.progressMode);
        applySettings({ wpm: currentWpm, mode: currentMode, font: currentFont, fontWeight: currentWeight, theme: newTheme });
    });
}

if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
        const newFont = e.target.value;
        const currentWeight = weightSelect ? weightSelect.value : '400';
        const currentTheme = themeSelect ? themeSelect.value : 'light';
        updateWeightDropdown(newFont, currentWeight);
        const newValidWeight = weightSelect.value;
        StorageService.saveSettings(currentWpm, currentMode, newFont, newValidWeight, currentTheme, ReaderEngine.progressMode);
        document.documentElement.style.setProperty('--font-family', fontConfig[newFont].family);
        document.documentElement.style.setProperty('--font-weight', newValidWeight);
    });
}

if (weightSelect) {
    weightSelect.addEventListener('change', (e) => {
        const newWeight = e.target.value;
        const currentFont = fontSelect ? fontSelect.value : 'classic';
        const currentTheme = themeSelect ? themeSelect.value : 'light';
        StorageService.saveSettings(currentWpm, currentMode, currentFont, newWeight, currentTheme, ReaderEngine.progressMode);
        document.documentElement.style.setProperty('--font-weight', newWeight);
    });
}

if(btnFactoryReset) {
    btnFactoryReset.addEventListener('click', () => {
        if(confirm("Reset all settings?")) {
            isResetting = true;
            StorageService.clearSettings();
            location.reload();
        }
    });
}
settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) closeSettings(); });

epubInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        showToast("Processing...", toast);
        const reader = new FileReader();
        reader.onload = (e) => EpubBridge.loadBook(e.target.result);
        reader.readAsArrayBuffer(file);
        window.tempUploadFile = file;
    }
});

EpubBridge.onMetadataReady = async (title, author) => {
    currentBookTitle = title || "Unknown Title";
    currentBookAuthor = author || "";
    bookMetadata.textContent = `${currentBookTitle}`;
    bookMetadata.style.display = 'block';
    if (window.tempUploadFile) {
        const newBook = await StorageService.addBook(window.tempUploadFile, currentBookTitle, currentBookAuthor);
        currentBookId = newBook.id;
        window.tempUploadFile = null;
        showToast("Saved to Library", toast);
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
    StorageService.getLibrary().then(lib => {
        const book = lib.find(b => b.id === currentBookId);
        if (book && book.chapterHref) {
            chapterSelect.value = book.chapterHref;
            EpubBridge.loadChapter(book.chapterHref);
            window.tempWordIndex = book.wordIndex; 
        } else {
            if(chapters.length > 0) EpubBridge.loadChapter(chapters[0].href);
        }
    });
    resumeCard.style.display = 'none';
    uploadCard.style.display = 'none';
    epubControls.style.display = 'flex';
});

chapterSelect.addEventListener('change', (e) => {
    ReaderEngine.pause();
    EpubBridge.loadChapter(e.target.value);
});

EpubBridge.onChapterReady = (htmlContent) => {
    const words = parseHTMLToRSVP(htmlContent);
    let targetIndex = 0;
    if (window.tempWordIndex !== undefined) {
        targetIndex = window.tempWordIndex;
        window.tempWordIndex = undefined;
    }
    const startIndex = (targetIndex > 0) ? Math.min(words.length - 1, targetIndex) : 0;
    ReaderEngine.loadContent(words, startIndex);
    
    if (startIndex > 0) showToast(`Resumed at word ${startIndex}`, toast);
    else showToast("Chapter Loaded", toast);
    
    if (words.length > 0) renderWord(words[startIndex], wordOutput);
    else renderWord("Empty", wordOutput);
};

function saveCurrentState() {
    if (currentMode === 'epub' && currentBookId && EpubBridge.book) {
        const href = chapterSelect.value;
        StorageService.saveProgress(currentBookId, href, ReaderEngine.currentIndex);
    }
    const currentFont = fontSelect ? fontSelect.value : 'classic';
    const currentWeight = weightSelect ? weightSelect.value : '400';
    const currentTheme = themeSelect ? themeSelect.value : 'light';
    StorageService.saveSettings(currentWpm, currentMode, currentFont, currentWeight, currentTheme, ReaderEngine.progressMode);
}

window.addEventListener('beforeunload', () => { if (!isResetting) saveCurrentState(); });

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-content-${btn.dataset.target}`).classList.add('active');
        currentMode = btn.dataset.target;
        ReaderEngine.reset();
        if(currentMode === 'text') {
            ReaderEngine.loadContent([]);
            renderWord("Ready", wordOutput);
        }
    });
});

btnPrevChapter.addEventListener('click', () => {
    const prev = EpubBridge.getPreviousChapter();
    if (prev) { chapterSelect.value = prev; EpubBridge.loadChapter(prev); }
});
btnNextChapter.addEventListener('click', () => {
    const next = EpubBridge.getNextChapter();
    if (next) { chapterSelect.value = next; EpubBridge.loadChapter(next); }
});
btnSyncPhrase.addEventListener('click', () => {
    const phrase = prompt("Find phrase (3+ words):");
    if (phrase) {
        const idx = EpubBridge.findPhraseIndex(ReaderEngine.words, phrase);
        if (idx !== -1) {
            ReaderEngine.currentIndex = idx;
            renderWord(ReaderEngine.words[idx], wordOutput);
            ReaderEngine.updateProgress();
            showToast("Synced!", toast);
        } else { alert("Not found."); }
    }
});

function initData() {
    if (currentMode === 'epub') {
        if (ReaderEngine.words.length > 0) return true;
        alert("Load an EPUB first.");
        return false;
    }
    const rawText = inputText.value.trim();
    if (!rawText) { alert("Please enter some text."); return false; }
    const words = parseContent(rawText);
    ReaderEngine.loadContent(words);
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

function flashFeedback(side) {
    const el = side === 'left' ? feedbackLeft : feedbackRight;
    el.classList.add('active'); setTimeout(() => el.classList.remove('active'), 300);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        readerDisplay.requestFullscreen().catch(err => alert(err));
        document.body.classList.add('fullscreen-active');
        if (screen.orientation && screen.orientation.lock) {
            try { screen.orientation.lock('landscape'); } catch (e) { console.warn(e); }
        }
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

readerDisplay.addEventListener('touchend', (e) => {
    if (e.target.closest('#mobile-fs-toolbar') || 
        e.target.tagName === 'BUTTON' || 
        e.target.closest('#context-overlay') || 
        e.target.closest('#progress-indicator')) return;

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
        if (yRatio < 0.20 || yRatio > 0.80) return; 
    }

    if (zone === 'center') {
        clearTimeout(tapTimeout);
        tapCount = 0;
        if (ReaderEngine.words.length === 0) { if (!initData()) return; }
        if (isContextOpen) { toggleContextView(); ReaderEngine.start(); }
        else ReaderEngine.toggle();
        e.preventDefault();
        return;
    }

    if (now - lastTapTime < 400) tapCount++;
    else tapCount = 1;
    lastTapTime = now;

    clearTimeout(tapTimeout);

    if (tapCount === 1) {
        tapTimeout = setTimeout(() => { tapCount = 0; }, 400);
    } else if (tapCount === 2) {
        if (zone === 'left') {
            const jump = ReaderEngine.skipWords('left');
            showToast(`⏪ -${jump}`, toast);
            flashFeedback('left');
        } else if (zone === 'right') {
            const jump = ReaderEngine.skipWords('right');
            showToast(`⏩ +${jump}`, toast);
            flashFeedback('right');
        }
    } else if (tapCount === 3) {
        if (zone === 'left') { 
            ReaderEngine.skipParagraph('prev');
            showToast("⏮ Paragraph Start", toast);
            flashFeedback('left');
        }
        tapCount = 0; 
    }
    e.preventDefault();
});

btnToggle.addEventListener('click', () => {
    if (ReaderEngine.words.length === 0) { if (!initData()) return; }
    if (isContextOpen) { toggleContextView(); ReaderEngine.start(); }
    else ReaderEngine.toggle();
});

btnReset.addEventListener('click', () => {
    ReaderEngine.reset();
    if (currentMode === 'text') {
        ReaderEngine.loadContent([]);
        renderWord("Ready", wordOutput);
    }
});

btnContext.addEventListener('click', toggleContextView);
btnFullscreen.addEventListener('click', toggleFullscreen);
btnFsExit.addEventListener('click', toggleFullscreen);
btnFsContext.addEventListener('click', toggleContextView);

readerDisplay.addEventListener('click', (e) => { 
    if (e.target.closest('#context-overlay') || 
        e.target.closest('#progress-indicator') ||
        e.target.closest('#mobile-fs-toolbar') ||
        e.target.tagName === 'BUTTON') return; 
    ReaderEngine.toggle(); 
});

progressIndicator.addEventListener('click', (e) => {
    e.stopPropagation();
    ReaderEngine.cycleProgressMode();
    saveCurrentState();
});

function toggleContextView() {
    if (ReaderEngine.words.length === 0) { if (!initData()) return; }
    isContextOpen = !isContextOpen;
    if (isContextOpen) {
        ReaderEngine.pause();
        contextOverlay.innerHTML = '<button class="close-ctx-btn">Close X</button>';
        contextOverlay.querySelector('.close-ctx-btn').onclick = toggleContextView;
        ReaderEngine.words.forEach((wordObj, index) => {
            if (wordObj.type === 'break') {
                const br = document.createElement('div'); br.className = 'ctx-break'; contextOverlay.appendChild(br);
            } else {
                const span = document.createElement('span'); span.textContent = wordObj.text + " "; span.className = 'ctx-word';
                if (wordObj.bold) span.style.fontWeight = 'bold';
                if (wordObj.italic) span.style.fontStyle = 'italic';
                if (wordObj.header) { 
                    span.style.fontWeight = 'bold'; span.style.color = '#2a9d8f'; span.style.display = 'inline-block';
                    if (wordObj.headerLevel === 1) { span.style.fontSize = '1.6em'; span.style.color = '#e76f51'; span.style.marginTop = '10px'; }
                    else if (wordObj.headerLevel === 2) { span.style.fontSize = '1.3em'; span.style.marginTop = '8px'; }
                }
                if (index === ReaderEngine.currentIndex - 1 && ReaderEngine.currentIndex > 0) { 
                    span.classList.add('current'); 
                    setTimeout(() => span.scrollIntoView({block: "center", behavior: "smooth"}), 50); 
                }
                span.onclick = () => { 
                    ReaderEngine.currentIndex = index + 1;
                    renderWord(ReaderEngine.words[index], wordOutput); 
                    ReaderEngine.updateProgress();
                    showToast("Jump", toast); 
                    toggleContextView(); 
                };
                contextOverlay.appendChild(span);
            }
        });
        contextOverlay.classList.add('active');
    } else { contextOverlay.classList.remove('active'); }
}
