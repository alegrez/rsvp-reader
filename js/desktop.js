let words = [];
let currentIndex = 0;
let isPlaying = false;
let timerOut = null;
let isContextOpen = false;
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
const wpmInput = document.getElementById('wpm');
const toast = document.getElementById('toast');
const contextOverlay = document.getElementById('context-overlay');

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
    if(settings.wpm) wpmInput.value = settings.wpm;
    
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
        resumeInfo.textContent = `Progress saved`; 
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
        showToast("Loading book from storage...", toast);
        EpubBridge.loadBook(fileBlob);
    } else {
        alert("Error: Book file not found in storage.");
        resetBookData();
    }
});

btnDeleteBook.addEventListener('click', async () => {
    if(confirm("Remove this book and progress?")) {
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
        showToast("Processing & Saving...", toast);
        await StorageService.saveBookFile(file);
        
        const reader = new FileReader();
        reader.onload = (e) => EpubBridge.loadBook(e.target.result);
        reader.readAsArrayBuffer(file);
    }
});

EpubBridge.onMetadataReady = (title, author) => {
    currentBookTitle = title || "Unknown Title";
    currentBookAuthor = author || "";

    bookMetadata.textContent = `${currentBookTitle} - ${currentBookAuthor}`;
    bookMetadata.style.display = 'block';
    epubControls.style.display = 'flex';

    saveCurrentState();
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

window.addEventListener('beforeunload', () => {
    saveCurrentState();
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
    }
};

function saveCurrentState() {
    if (currentMode === 'epub' && EpubBridge.book) {
        const href = chapterSelect.value;
        
        StorageService.saveProgress(currentBookTitle, currentBookAuthor, href, currentIndex);
    }
}

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
    const phrase = prompt("Enter the last 3-4 words you read:");
    if (phrase) {
        const idx = EpubBridge.findPhraseIndex(words, phrase);
        if (idx !== -1) {
            currentIndex = idx;
            renderWord(words[currentIndex], wordOutput);
            showToast("Synced!", toast);
        } else {
            alert("Phrase not found in this chapter.");
        }
    }
});

function initData() {
    if (currentMode === 'epub') {
        if (words.length > 0) return true;
        alert("Please load an ePUB first.");
        return false;
    }
    const rawText = inputText.value.trim();
    if (!rawText) { alert("Please enter some text."); return false; }
    words = parseContent(rawText);
    return true;
}

function startReader() {
    if (words.length === 0) { if (!initData()) return; }
    if (currentIndex >= words.length) currentIndex = 0;
    isPlaying = true;
    btnToggle.textContent = "Pause";
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

    const wpm = parseInt(wpmInput.value) || 300;
    const baseDelay = 60000 / wpm;
    let finalDelay = baseDelay;

    if (currentWordObj.type === 'break') {
        finalDelay = baseDelay * 4.0;
    } else {
        const text = currentWordObj.text;
        const lastChar = text.slice(-1);
        if (',;'.includes(lastChar)) finalDelay = baseDelay * 2.0; 
        else if ('.?!:”。'.includes(lastChar)) finalDelay = baseDelay * 3.0;
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
    if(currentMode === 'text') words = []; 
    btnToggle.textContent = "Start"; renderWord("Ready", wordOutput);
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
    showToast(direction === 'prev' ? "Prev Paragraph Start" : "Next Paragraph Start", toast);
}

function toggleContextView() {
    if (words.length === 0) { if (!initData()) return; }
    isContextOpen = !isContextOpen;
    if (isContextOpen) {
        pauseReader(); contextOverlay.innerHTML = '';

        words.forEach((wordObj, index) => {
            if (wordObj.type === 'break') {
                const br = document.createElement('div'); br.className = 'ctx-break'; 
                contextOverlay.appendChild(br);
            } else {
                const span = document.createElement('span'); 
                span.textContent = wordObj.text + " "; span.className = 'ctx-word';
                
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

                if (index === currentIndex - 1 && currentIndex > 0) {
                    span.classList.add('current'); 
                    setTimeout(() => span.scrollIntoView({block: "center", behavior: "smooth"}), 50);
                }
                span.onclick = () => { 
                    currentIndex = index; renderWord(words[currentIndex], wordOutput); 
                    showToast("Jump to position", toast); toggleContextView(); 
                };
                contextOverlay.appendChild(span);
            }
        });
        contextOverlay.classList.add('active');
    } else { contextOverlay.classList.remove('active'); }
}

document.addEventListener('keydown', (e) => {
    if (document.activeElement === inputText || document.activeElement === wpmInput) return;
    switch(e.code) {
        case 'Space': e.preventDefault(); togglePlayPause(); break;
        case 'ArrowUp': e.preventDefault(); changeSpeed(25); break;
        case 'ArrowDown': e.preventDefault(); changeSpeed(-25); break;
        case 'ArrowLeft': e.preventDefault(); e.ctrlKey ? skipParagraph('prev') : skipWords('left'); break;
        case 'ArrowRight': e.preventDefault(); e.ctrlKey ? skipParagraph('next') : skipWords('right'); break;
        case 'KeyV': e.preventDefault(); toggleContextView(); break;
    }
});

btnToggle.addEventListener('click', togglePlayPause);
btnReset.addEventListener('click', resetReader);
btnContext.addEventListener('click', toggleContextView);
btnFullscreen.addEventListener('click', () => { 
    if (!document.fullscreenElement) { readerDisplay.requestFullscreen().catch(err => alert(err)); } 
    else { document.exitFullscreen(); } 
});
readerDisplay.addEventListener('click', (e) => { if (e.target.closest('#context-overlay')) return; togglePlayPause(); });
