/**
 * Maneja la persistencia usando IndexedDB (para el archivo) y LocalStorage (para configuraciones simples)
 * Dependencia: idb-keyval (cargada via CDN)
 */

const StorageService = {
    KEY_FILE: 'rsvp_epub_file',
    KEY_META: 'rsvp_epub_meta',
    KEY_SETTINGS: 'rsvp_settings',


    async saveBookFile(fileBlob) {
        if (!window.idbKeyval) return;
        try {
            await idbKeyval.set(this.KEY_FILE, fileBlob);
            console.log("EPUB saved to IndexedDB");
        } catch (e) {
            console.error("Error saving book:", e);
        }
    },

    async loadBookFile() {
        if (!window.idbKeyval) return null;
        try {
            return await idbKeyval.get(this.KEY_FILE);
        } catch (e) {
            console.error("Error loading book:", e);
            return null;
        }
    },

    async clearBookData() {
        if (!window.idbKeyval) return;
        await idbKeyval.del(this.KEY_FILE);
        await idbKeyval.del(this.KEY_META);
    },

    async saveProgress(title, author, chapterHref, wordIndex) {
        if (!window.idbKeyval) return;
        const data = {
            title, 
            author, 
            chapterHref, 
            wordIndex, 
            lastActive: Date.now()
        };
        await idbKeyval.set(this.KEY_META, data);
    },

    async getProgress() {
        if (!window.idbKeyval) return null;
        return await idbKeyval.get(this.KEY_META);
    },

    
    saveSettings(wpm, mode) {
        const settings = { wpm, mode };
        localStorage.setItem(this.KEY_SETTINGS, JSON.stringify(settings));
    },

    getSettings() {
        const s = localStorage.getItem(this.KEY_SETTINGS);
        return s ? JSON.parse(s) : { wpm: 300, mode: 'text' };
    }
};
