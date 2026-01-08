let words = [];
let currentIndex = 0;
let isPlaying = false;
let timerOut = null;
let isContextOpen = false;
let currentMode = 'text';
let currentBookId = null;
let currentBookTitle = 'Unknown Title';
let currentBookAuthor = '';
let progressMode = 1;
let isResetting = false;

const inputText = document.getElementById('inputText');
const wordOutput = document.getElementById('wordOutput');
const btnToggle = document.getElementById('btnToggle');
const btnReset = document.getElementById('btnReset');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnContext = document.getElementById('btnContext');
const readerDisplay = document.getElementById('reader-display');
const wpmInput = document.getElementById('wpm');
const toast = document.getElementById('toast');
const contextOverlay = document.getElementById('context-overlay');
const progressIndicator = document.getElementById('progress-indicator');

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
    classic: {
        family: "'Courier New', Courier, monospace",
        weights: [400, 700],
    },
    opendyslexic: {
        family: '"OpenDyslexic", "Comic Sans MS", sans-serif',
        weights: [400, 700],
    },
    system: {
        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        weights: [300, 400, 500, 700],
    },
    mono: {
        family: '"Roboto Mono", monospace',
        weights: [300, 400, 500, 700],
    },
    serif: {
        family: '"Merriweather", serif',
        weights: [300, 400, 700, 900],
    },
};

const weightLabels = {
    300: 'Light',
    400: 'Normal',
    500: 'Medium',
    700: 'Bold',
    900: 'Black',
};

function updateWeightDropdown(fontKey, preferredWeight) {
    if (!weightSelect) return;

    const config = fontConfig[fontKey] || fontConfig['classic'];
    const validWeights = config.weights;

    weightSelect.innerHTML = '';

    validWeights.forEach((w) => {
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

    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
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
    renderWord('Ready', wordOutput);
    EpubBridge.init();

    const settings = StorageService.getSettings();
    if (settings.wpm) wpmInput.value = settings.wpm;
    if (settings.progressMode !== undefined) progressMode = settings.progressMode;

    applySettings(settings);
    updateProgress();
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
        resumeInfo.textContent = 'Progress saved';
    } else {
        resumeCard.style.display = 'none';
        uploadCard.style.display = 'block';
    }
}

async function renderLibraryList() {
    const books = await StorageService.getLibrary();
    libraryList.innerHTML = '';

    if (books.length === 0) {
        libraryList.innerHTML = '<div class="empty-lib-msg">No books yet. Upload one!</div>';
        return;
    }

    books.forEach((book) => {
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

    libraryList.querySelectorAll('.btn-lib-open').forEach((btn) => {
        btn.onclick = () => loadBookFromLibrary(btn.dataset.id);
    });
    libraryList.querySelectorAll('.btn-lib-del').forEach((btn) => {
        btn.onclick = () => deleteBookFromLibrary(btn.dataset.id);
    });
}

async function loadBookFromLibrary(bookId) {
    libraryOverlay.classList.remove('active');

    const fileBlob = await StorageService.loadBookFile(bookId);
    if (fileBlob) {
        currentBookId = bookId;
        showToast('Loading book...', toast);
        EpubBridge.loadBook(fileBlob);
    } else {
        alert('Error loading book data.');
    }
}

async function deleteBookFromLibrary(bookId) {
    if (confirm('Delete this book?')) {
        await StorageService.deleteBook(bookId);
        await renderLibraryList();

        if (currentBookId === bookId) {
            currentBookId = null;
            checkLastReadBook();
            resetReader();
            bookMetadata.style.display = 'none';
            epubControls.style.display = 'none';
        }
    }
}

btnResume.addEventListener('click', () => {
    if (currentBookId) loadBookFromLibrary(currentBookId);
});

btnOpenLibrary.addEventListener('click', () => {
    renderLibraryList();
    libraryOverlay.classList.add('active');
});

if (btnLibraryFromControls) {
    btnLibraryFromControls.addEventListener('click', () => {
        if (isPlaying) pauseReader();
        renderLibraryList();
        libraryOverlay.classList.add('active');
    });
}

btnUploadNew.addEventListener('click', () => {
    resumeCard.style.display = 'none';
    uploadCard.style.display = 'block';
});

btnCloseLibrary.addEventListener('click', () => libraryOverlay.classList.remove('active'));
btnUploadFromLib.addEventListener('click', () => {
    libraryOverlay.classList.remove('active');
    resumeCard.style.display = 'none';
    uploadCard.style.display = 'block';
    document.querySelector('.tab-btn[data-target="epub"]').click();
});

epubInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        showToast('Processing...', toast);

        const reader = new FileReader();
        reader.onload = (e) => EpubBridge.loadBook(e.target.result);
        reader.readAsArrayBuffer(file);

        window.tempUploadFile = file;
    }
});

EpubBridge.onMetadataReady = async (title, author) => {
    currentBookTitle = title || 'Unknown Title';
    currentBookAuthor = author || '';

    bookMetadata.textContent = `${currentBookTitle} - ${currentBookAuthor}`;
    bookMetadata.style.display = 'block';
    epubControls.style.display = 'flex';

    if (window.tempUploadFile) {
        const newBook = await StorageService.addBook(window.tempUploadFile, currentBookTitle, currentBookAuthor);
        currentBookId = newBook.id;
        window.tempUploadFile = null;
        showToast('Book Saved to Library', toast);
    }

    const library = await StorageService.getLibrary();
    const bookData = library.find((b) => b.id === currentBookId);
};

function saveCurrentState() {
    if (currentMode === 'epub' && currentBookId && EpubBridge.book) {
        const href = chapterSelect.value;
        StorageService.saveProgress(currentBookId, href, currentIndex);
    }

    const currentFont = fontSelect ? fontSelect.value : 'classic';
    const currentWeight = weightSelect ? weightSelect.value : '400';
    const currentTheme = themeSelect ? themeSelect.value : 'light';
    const wpm = parseInt(wpmInput.value) || 300;
    StorageService.saveSettings(wpm, currentMode, currentFont, currentWeight, currentTheme, progressMode);
}

document.addEventListener('epubChaptersLoaded', (e) => {
    const chapters = e.detail;
    chapterSelect.innerHTML = '';
    chapters.forEach((ch) => {
        const opt = document.createElement('option');
        opt.value = ch.href;
        opt.textContent = ch.label;
        chapterSelect.appendChild(opt);
    });

    StorageService.getLibrary().then((lib) => {
        const book = lib.find((b) => b.id === currentBookId);
        if (book && book.chapterHref) {
            chapterSelect.value = book.chapterHref;
            EpubBridge.loadChapter(book.chapterHref);
            window.tempWordIndex = book.wordIndex;
        } else {
            if (chapters.length > 0) EpubBridge.loadChapter(chapters[0].href);
        }
    });

    resumeCard.style.display = 'none';
    uploadCard.style.display = 'none';
    epubControls.style.display = 'flex';
});

EpubBridge.onChapterReady = (htmlContent) => {
    words = parseHTMLToRSVP(htmlContent);

    let targetIndex = 0;
    if (window.tempWordIndex !== undefined) {
        targetIndex = window.tempWordIndex;
        window.tempWordIndex = undefined;
    }

    if (targetIndex > 0) {
        currentIndex = Math.min(words.length - 1, targetIndex);
        showToast(`Resumed at word ${currentIndex}`, toast);
    } else {
        currentIndex = 0;
        showToast('Chapter Loaded', toast);
    }

    if (words.length > 0) {
        renderWord(words[currentIndex], wordOutput);
    } else {
        renderWord('Empty', wordOutput);
    }
    updateProgress();
};

if (btnSettings) {
    btnSettings.addEventListener('click', () => {
        settingsOverlay.classList.add('active');
        if (isPlaying) togglePlayPause();
    });
}
function closeSettings() {
    settingsOverlay.classList.remove('active');
}
if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettings);
if (btnSaveSettings) btnSaveSettings.addEventListener('click', closeSettings);

if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        const currentFont = fontSelect ? fontSelect.value : 'classic';
        const currentWeight = weightSelect ? weightSelect.value : '400';
        const currentWpmVal = parseInt(wpmInput.value) || 300;

        StorageService.saveSettings(currentWpmVal, currentMode, currentFont, currentWeight, newTheme, progressMode);
        applySettings({
            wpm: currentWpmVal,
            mode: currentMode,
            font: currentFont,
            fontWeight: currentWeight,
            theme: newTheme,
        });
    });
}

if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
        const newFont = e.target.value;
        const currentWeight = weightSelect ? weightSelect.value : '400';
        const currentTheme = themeSelect ? themeSelect.value : 'light';

        updateWeightDropdown(newFont, currentWeight);

        const newValidWeight = weightSelect.value;
        const currentWpmVal = parseInt(wpmInput.value) || 300;

        StorageService.saveSettings(currentWpmVal, currentMode, newFont, newValidWeight, currentTheme, progressMode);
        document.documentElement.style.setProperty('--font-family', fontConfig[newFont].family);
        document.documentElement.style.setProperty('--font-weight', newValidWeight);
    });
}

if (weightSelect) {
    weightSelect.addEventListener('change', (e) => {
        const newWeight = e.target.value;
        const currentFont = fontSelect ? fontSelect.value : 'classic';
        const currentWpmVal = parseInt(wpmInput.value) || 300;
        const currentTheme = themeSelect ? themeSelect.value : 'light';

        StorageService.saveSettings(currentWpmVal, currentMode, currentFont, newWeight, currentTheme, progressMode);
        document.documentElement.style.setProperty('--font-weight', newWeight);
    });
}
if (btnFactoryReset) {
    btnFactoryReset.addEventListener('click', () => {
        if (confirm('Reset all settings?')) {
            isResetting = true;
            StorageService.clearSettings();
            location.reload();
        }
    });
}
settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
});

tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        tabContents.forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-content-${btn.dataset.target}`).classList.add('active');
        currentMode = btn.dataset.target;
        resetReader();
    });
});

chapterSelect.addEventListener('change', (e) => {
    pauseReader();
    EpubBridge.loadChapter(e.target.value);
});

window.addEventListener('beforeunload', () => {
    if (!isResetting) saveCurrentState();
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
    const phrase = prompt('Enter phrase to find:');
    if (phrase) {
        const idx = EpubBridge.findPhraseIndex(words, phrase);
        if (idx !== -1) {
            currentIndex = idx;
            renderWord(words[currentIndex], wordOutput);
            showToast('Synced!', toast);
        } else {
            alert('Phrase not found.');
        }

        updateProgress();
    }
});

function initData() {
    if (currentMode === 'epub') {
        if (words.length > 0) return true;
        alert('Please load an ePUB first.');
        return false;
    }
    const rawText = inputText.value.trim();
    if (!rawText) {
        alert('Please enter some text.');
        return false;
    }
    words = parseContent(rawText);
    return true;
}

function startReader() {
    if (words.length === 0) {
        if (!initData()) return;
    }
    if (currentIndex >= words.length) currentIndex = 0;
    isPlaying = true;
    btnToggle.textContent = 'Pause';
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
    updateProgress();
    const wpm = parseInt(wpmInput.value) || 300;
    let finalDelay = 60000 / wpm;
    if (currentWordObj.type === 'break') {
        finalDelay *= 4.0;
    } else {
        const text = currentWordObj.text;
        const len = text.length;
        const lastChar = text.slice(-1);
        if (',;'.includes(lastChar)) finalDelay *= 2.0;
        else if ('.?!:”。'.includes(lastChar)) finalDelay *= 3.0;

        if (len > 15) finalDelay = finalDelay * 2.0;
        else if (len > 10) finalDelay = finalDelay * 1.7;
    }
    currentIndex++;
    timerOut = setTimeout(loopReader, finalDelay);
}

function pauseReader() {
    isPlaying = false;
    clearTimeout(timerOut);
    btnToggle.textContent = 'Continue';
    saveCurrentState();
}
function togglePlayPause() {
    if (isContextOpen) {
        toggleContextView();
        startReader();
    } else {
        isPlaying ? pauseReader() : startReader();
    }
}
function resetReader() {
    pauseReader();
    currentIndex = 0;
    if (currentMode === 'text') words = [];
    btnToggle.textContent = 'Start';
    renderWord('Ready', wordOutput);
    updateProgress();
}
function changeSpeed(delta) {
    let current = parseInt(wpmInput.value) || 300;
    let newVal = current + delta;
    if (newVal < 60) newVal = 60;
    wpmInput.value = newVal;
    showToast(`Speed: ${newVal} WPM`, toast);
}

function skipWords(direction) {
    if (words.length === 0) return;
    const wpm = parseInt(wpmInput.value) || 300;
    const jumpSize = Math.max(5, Math.floor((wpm / 60) * 2));
    const delta = direction === 'left' ? -jumpSize : jumpSize;
    let newIndex = currentIndex + delta;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= words.length) newIndex = words.length - 1;
    currentIndex = newIndex;
    renderWord(words[currentIndex], wordOutput);
    showToast(direction === 'left' ? `⏪ ${jumpSize}` : `⏩ ${jumpSize}`, toast);
}
function skipParagraph(direction) {
    if (words.length === 0) return;
    let newIndex = currentIndex;
    if (direction === 'prev') {
        newIndex = Math.max(0, newIndex - 2);
        while (newIndex > 0 && words[newIndex].type !== 'break') newIndex--;
        if (words[newIndex].type === 'break') newIndex++;
    } else {
        while (newIndex < words.length && words[newIndex].type !== 'break') newIndex++;
        if (newIndex < words.length) newIndex++;
    }

    if (newIndex >= words.length) newIndex = words.length - 1;
    if (newIndex < 0) newIndex = 0;
    currentIndex = newIndex;
    renderWord(words[currentIndex], wordOutput);
    updateProgress();
    showToast(direction === 'prev' ? 'Prev Paragraph' : 'Next Paragraph', toast);
}
function toggleContextView() {
    if (words.length === 0) {
        if (!initData()) return;
    }
    isContextOpen = !isContextOpen;
    if (isContextOpen) {
        pauseReader();
        contextOverlay.innerHTML = '';
        words.forEach((wordObj, index) => {
            if (wordObj.type === 'break') {
                const br = document.createElement('div');
                br.className = 'ctx-break';
                contextOverlay.appendChild(br);
            } else {
                const span = document.createElement('span');
                span.textContent = wordObj.text + ' ';
                span.className = 'ctx-word';
                if (wordObj.bold) span.style.fontWeight = 'bold';
                if (wordObj.italic) span.style.fontStyle = 'italic';
                if (wordObj.header) {
                    span.style.fontWeight = 'bold';
                    span.style.color = '#2a9d8f';
                    span.style.display = 'inline-block';
                    if (wordObj.headerLevel === 1) {
                        span.style.fontSize = '1.6em';
                        span.style.color = '#e76f51';
                        span.style.marginTop = '10px';
                    } else if (wordObj.headerLevel === 2) {
                        span.style.fontSize = '1.3em';
                        span.style.marginTop = '8px';
                    }
                }
                if (index === currentIndex - 1 && currentIndex > 0) {
                    span.classList.add('current');
                    setTimeout(
                        () =>
                            span.scrollIntoView({
                                block: 'center',
                                behavior: 'smooth',
                            }),
                        50,
                    );
                }
                span.onclick = () => {
                    currentIndex = index;
                    renderWord(words[currentIndex], wordOutput);
                    showToast('Jump', toast);
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

document.addEventListener('keydown', (e) => {
    if (document.activeElement === inputText || document.activeElement === wpmInput) return;
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            togglePlayPause();
            break;
        case 'ArrowUp':
            e.preventDefault();
            changeSpeed(25);
            break;
        case 'ArrowDown':
            e.preventDefault();
            changeSpeed(-25);
            break;
        case 'ArrowLeft':
            e.preventDefault();
            e.ctrlKey ? skipParagraph('prev') : skipWords('left');
            break;
        case 'ArrowRight':
            e.preventDefault();
            e.ctrlKey ? skipParagraph('next') : skipWords('right');
            break;
        case 'KeyV':
            e.preventDefault();
            toggleContextView();
            break;
    }
});

btnToggle.addEventListener('click', togglePlayPause);
btnReset.addEventListener('click', resetReader);
btnContext.addEventListener('click', toggleContextView);
btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        readerDisplay.requestFullscreen().catch((err) => alert(err));
    } else {
        document.exitFullscreen();
    }
});
readerDisplay.addEventListener('click', (e) => {
    if (e.target.closest('#context-overlay')) return;
    togglePlayPause();
});

function updateProgress() {
    if (!progressIndicator) return;

    if (!words || words.length === 0) {
        progressIndicator.textContent = '';
        return;
    }

    const total = words.length;
    const current = Math.min(currentIndex + 1, total);

    if (progressMode === 0) {
        progressIndicator.textContent = '';
    } else if (progressMode === 1) {
        const percent = Math.floor((current / total) * 100);
        progressIndicator.textContent = `${percent}%`;
    } else if (progressMode === 2) {
        progressIndicator.textContent = `${current} / ${total}`;
    }
}

progressIndicator.addEventListener('click', (e) => {
    e.stopPropagation();
    progressMode = (progressMode + 1) % 3;
    updateProgress();
    saveCurrentState();
});
