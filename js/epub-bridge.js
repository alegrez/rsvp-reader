/**
 * FILE: js/epub-bridge.js
 * EPUB Bridge for RSVP Reader - XML/XHTML COMPATIBLE
 */

const EpubBridge = {
    book: null,
    chapters: [],
    currentChapterHref: null,
    
    onChapterReady: null, 
    onMetadataReady: null,

    init: function() {
        console.log("EpubBridge Initialized");
    },

    loadBook: function(fileData) {
        if (!window.ePub) {
            alert("Epub.js library not loaded.");
            return;
        }

        if (this.book) {
            this.book.destroy();
        }

        this.book = ePub(fileData);
        
        this.book.loaded.metadata.then((meta) => {
            if (this.onMetadataReady) {
                this.onMetadataReady(meta.title, meta.creator);
            }
        });

        this.book.loaded.navigation.then((nav) => {
            this.chapters = [];
            const traverse = (items) => {
                items.forEach(item => {
                    this.chapters.push({
                        label: (item.label || "Untitled").trim(),
                        href: item.href
                    });
                    if (item.subitems && item.subitems.length > 0) {
                        traverse(item.subitems);
                    }
                });
            };
            
            if (nav.toc) traverse(nav.toc);
            
            if (this.chapters.length === 0) {
                this.book.spine.each((item) => {
                    this.chapters.push({
                         label: "Chapter " + (item.index + 1),
                         href: item.href
                    });
                });
            }
            
            const event = new CustomEvent('epubChaptersLoaded', { detail: this.chapters });
            document.dispatchEvent(event);
        }).catch(err => {
            console.error("Error loading navigation:", err);
            this.chapters = [];
             this.book.spine.each((item) => {
                this.chapters.push({ label: "Part " + (item.index + 1), href: item.href });
            });
            const event = new CustomEvent('epubChaptersLoaded', { detail: this.chapters });
            document.dispatchEvent(event);
        });
    },

    loadChapter: async function(href) {
        if (!this.book) return;
        this.currentChapterHref = href;

        try {
            const cleanHref = href.split('#')[0];
            const item = this.book.spine.get(cleanHref) || this.book.spine.get(href);
            
            if(!item) {
                console.error("Chapter not found:", href);
                return;
            }

            const doc = await item.load(this.book.load.bind(this.book));
            
            let content = "";
            
            let body = doc.querySelector ? doc.querySelector('body') : null;
            if (!body && doc.getElementsByTagName) {
                body = doc.getElementsByTagName('body')[0];
            }

            if (body) {
                const serializer = new XMLSerializer();
                
                content = Array.from(body.childNodes)
                    .map(node => serializer.serializeToString(node))
                    .join('');
            } else {
                const serializer = new XMLSerializer();
                content = serializer.serializeToString(doc.documentElement || doc);
            }

            item.unload();

            if (this.onChapterReady) {
                this.onChapterReady(content || " ");
            }
            
        } catch (e) {
            console.error("Error loading chapter:", e);
            alert("Error reading chapter structure.");
        }
    },

    findPhraseIndex: function(wordsArray, phrase) {
        if (!phrase || phrase.trim().length === 0) return -1;
        
        const rawTokens = phrase.trim().split(/\s+/);
        
        const targetTokens = rawTokens.map(t => 
            t.toLowerCase().replace(/[^\wáéíóúñü]/g, '')
        ).filter(t => t.length > 0);
        
        if (targetTokens.length === 0) return -1;

        for (let i = 0; i < wordsArray.length; i++) {
            const wordObj = wordsArray[i];
            if (wordObj.type === 'break') continue;
            
            const currentBookWord = wordObj.text.toLowerCase().replace(/[^\wáéíóúñü]/g, '');
            
            if (currentBookWord === targetTokens[0]) {
                let match = true;
                let tokenIdx = 1;
                let offset = 1;
                
                while (tokenIdx < targetTokens.length) {
                    if ((i + offset) >= wordsArray.length) {
                        match = false;
                        break;
                    }

                    const nextWordObj = wordsArray[i + offset];
                    
                    if (nextWordObj.type === 'break') {
                        offset++;
                        continue;
                    }
                    
                    const nextBookWord = nextWordObj.text.toLowerCase().replace(/[^\wáéíóúñü]/g, '');
                    
                    if (nextBookWord !== targetTokens[tokenIdx]) {
                        match = false;
                        break;
                    }
                    
                    tokenIdx++;
                    offset++;
                }
                
                if (match) {
                    return i;
                }
            }
        }
        return -1;
    },
    
    getChapterIndexByHref: function(href) {
        return this.chapters.findIndex(c => c.href === href);
    },

    getPreviousChapter: function() {
        const idx = this.getChapterIndexByHref(this.currentChapterHref);
        if (idx > 0) return this.chapters[idx - 1].href;
        return null;
    },

    getNextChapter: function() {
        const idx = this.getChapterIndexByHref(this.currentChapterHref);
        if (idx !== -1 && idx < this.chapters.length - 1) return this.chapters[idx + 1].href;
        return null;
    }
};
