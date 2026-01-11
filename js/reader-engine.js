/**
 * FILE: js/reader-engine.js
 * Core logic for the RSVP Reader (State, Loop, Math)
 */

const ReaderEngine = {
    words: [],
    currentIndex: 0,
    isPlaying: false,
    timer: null,
    progressMode: 1,

    ui: {
        getWpm: () => 300,      
        renderWord: (w) => {},  
        renderProgress: (t) => {},
        onFinish: () => {},     
        onStateChange: (isPlaying) => {}
    },

    init(uiConfig) {
        this.ui = { ...this.ui, ...uiConfig };
    },

    loadContent(wordList, startIndex = 0) {
        this.words = wordList;
        this.currentIndex = startIndex;
        this.updateProgress();
    },

    start() {
        if (!this.words || this.words.length === 0) return;
        if (this.currentIndex >= this.words.length) this.currentIndex = 0;
        
        this.isPlaying = true;
        this.ui.onStateChange(true);
        this.loop();
    },

    pause() {
        this.isPlaying = false;
        clearTimeout(this.timer);
        this.ui.onStateChange(false);
    },

    toggle() {
        this.isPlaying ? this.pause() : this.start();
    },

    reset() {
        this.pause();
        this.currentIndex = 0;
        if (this.words.length > 0) {
            this.ui.renderWord(this.words[0]);
        } else {
            this.ui.renderWord("Ready");
        }
        this.updateProgress();
    },


    loop() {
        if (!this.isPlaying) return;

        if (this.currentIndex >= this.words.length) {
            this.pause();
            this.currentIndex = 0;
            if (this.ui.onFinish) this.ui.onFinish();
            return;
        }

        const currentWordObj = this.words[this.currentIndex];
        this.ui.renderWord(currentWordObj);
        this.updateProgress();

        const wpm = this.ui.getWpm();
        const baseDelay = 60000 / wpm;
        const factor = this._getWordWeight(currentWordObj);
        const finalDelay = baseDelay * factor;

        this.currentIndex++;
        this.timer = setTimeout(() => this.loop(), finalDelay);
    },

    skipWords(direction) {
        if (!this.words.length) return;
        
        const wpm = this.ui.getWpm();
        const jumpBase = Math.floor((wpm / 60) * 2); 
        const jumpSize = Math.max(5, jumpBase);
        
        const delta = direction === 'left' ? -jumpSize : jumpSize;
        
        let newIndex = this.currentIndex + delta;
        newIndex = Math.max(0, Math.min(this.words.length - 1, newIndex));
        
        this.currentIndex = newIndex;
        this.ui.renderWord(this.words[this.currentIndex]);
        this.updateProgress();
        
        return jumpSize;
    },

    skipParagraph(direction) {
        if (!this.words.length) return;
        
        let newIndex = this.currentIndex;
        
        if (direction === 'prev') {
            newIndex = Math.max(0, newIndex - 2);
            while (newIndex > 0 && this.words[newIndex].type !== 'break') newIndex--;
            if (this.words[newIndex].type === 'break') newIndex++;
        } else {
            while (newIndex < this.words.length && this.words[newIndex].type !== 'break') newIndex++;
            if (newIndex < this.words.length) newIndex++;
        }

        newIndex = Math.max(0, Math.min(this.words.length - 1, newIndex));
        this.currentIndex = newIndex;
        this.ui.renderWord(this.words[this.currentIndex]);
        this.updateProgress();
    },

    cycleProgressMode() {
        this.progressMode = (this.progressMode + 1) % 4;
        this.updateProgress();
        return this.progressMode;
    },

    updateProgress() {
        if (!this.words.length) {
            this.ui.renderProgress("");
            return;
        }

        const total = this.words.length;
        const current = Math.min(this.currentIndex + 1, total);
        let text = "";

        if (this.progressMode === 1) {
            const percent = Math.floor((current / total) * 100);
            text = `${percent}%`;
        } else if (this.progressMode === 2) {
            text = `${current} / ${total}`;
        } else if (this.progressMode === 3) {
            text = this._calculateTimeRemaining(current - 1, total);
        }

        this.ui.renderProgress(text);
    },


    _getWordWeight(wordObj) {
        if (wordObj.type === 'break') return 4.0;
        
        let factor = 1.0;
        const text = wordObj.text;
        const len = text.length;
        const lastChar = text.slice(-1);

        if (',;'.includes(lastChar)) factor *= 2.0;
        else if ('.?!:”。'.includes(lastChar)) factor *= 3.0;

        if (len > 15) factor *= 2.0;
        else if (len > 10) factor *= 1.7;

        return factor;
    },

    _calculateTimeRemaining(startIndex, total) {
        const wpm = this.ui.getWpm();
        if (wpm === 0) return "--";

        const remainingWords = total - startIndex;
        const msPerWordBase = 60000 / wpm;
        
        let totalMinutes = 0;

        if (remainingWords < 2000) {
            let weight = 0;
            for (let i = startIndex; i < total; i++) {
                weight += this._getWordWeight(this.words[i]);
            }
            totalMinutes = (weight * msPerWordBase) / 60000;
        } else {
            totalMinutes = (remainingWords * 1.3 * msPerWordBase) / 60000;
        }

        if (totalMinutes < 1) return "< 1m";
        const h = Math.floor(totalMinutes / 60);
        const m = Math.floor(totalMinutes % 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }
};
