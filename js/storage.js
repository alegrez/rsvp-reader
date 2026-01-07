/**
 * Maneja la persistencia usando IndexedDB
 * Dependencia: idb-keyval
 */

const StorageService = {
    KEY_LIB_INDEX: 'rsvp_library_index',
    KEY_SETTINGS: 'rsvp_settings',
    PREFIX_BOOK: 'rsvp_book_',

    async migrateOldData() {
        if (!window.idbKeyval) return;
        
        const oldFile = await idbKeyval.get('rsvp_epub_file');
        const oldMeta = await idbKeyval.get('rsvp_epub_meta');

        if (oldFile && oldMeta) {
            console.log("Migrating old book to library format...");
            await this.addBook(oldFile, oldMeta.title, oldMeta.author, oldMeta);
            
            await idbKeyval.del('rsvp_epub_file');
            await idbKeyval.del('rsvp_epub_meta');
            console.log("Migration complete.");
        }
    },

    async getLibrary() {
        if (!window.idbKeyval) return [];
        await this.migrateOldData();
        return (await idbKeyval.get(this.KEY_LIB_INDEX)) || [];
    },

    async addBook(fileBlob, title, author, initialProgress = null) {
        if (!window.idbKeyval) return null;
        
        const library = (await idbKeyval.get(this.KEY_LIB_INDEX)) || [];
        
        const bookId = crypto.randomUUID ? crypto.randomUUID() : 'book_' + Date.now();
        
        const newBook = {
            id: bookId,
            title: title || "Unknown Title",
            author: author || "Unknown Author",
            addedAt: Date.now(),
            lastRead: Date.now(),
            chapterHref: initialProgress ? initialProgress.chapterHref : null,
            wordIndex: initialProgress ? initialProgress.wordIndex : 0
        };

        await idbKeyval.set(this.PREFIX_BOOK + bookId, fileBlob);

        library.unshift(newBook);
        await idbKeyval.set(this.KEY_LIB_INDEX, library);

        return newBook;
    },

    async loadBookFile(bookId) {
        if (!window.idbKeyval) return null;
        return await idbKeyval.get(this.PREFIX_BOOK + bookId);
    },

    async deleteBook(bookId) {
        if (!window.idbKeyval) return;
        
        await idbKeyval.del(this.PREFIX_BOOK + bookId);
        
        let library = (await idbKeyval.get(this.KEY_LIB_INDEX)) || [];
        library = library.filter(b => b.id !== bookId);
        await idbKeyval.set(this.KEY_LIB_INDEX, library);
    },


    async saveProgress(bookId, chapterHref, wordIndex) {
        if (!window.idbKeyval || !bookId) return;
        
        const library = (await idbKeyval.get(this.KEY_LIB_INDEX)) || [];
        const bookIndex = library.findIndex(b => b.id === bookId);

        if (bookIndex !== -1) {
            library[bookIndex].chapterHref = chapterHref;
            library[bookIndex].wordIndex = wordIndex;
            library[bookIndex].lastRead = Date.now();
            
            const book = library.splice(bookIndex, 1)[0];
            library.unshift(book);

            await idbKeyval.set(this.KEY_LIB_INDEX, library);
        }
    },

    async getLastReadBook() {
        const library = await this.getLibrary();
        return library.length > 0 ? library[0] : null;
    },

    
    saveSettings(wpm, mode, font, fontWeight, theme) {
        const settings = { wpm, mode, font, fontWeight, theme };
        localStorage.setItem(this.KEY_SETTINGS, JSON.stringify(settings));
    },

    clearSettings() {
        localStorage.removeItem(this.KEY_SETTINGS);
    },

    getSettings() {
        const s = localStorage.getItem(this.KEY_SETTINGS);
        return s ? JSON.parse(s) : { wpm: 300, mode: 'text', font: 'classic', fontWeight: '400', theme: 'light' };
    }
};
