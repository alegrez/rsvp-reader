/**
 * FILE: js/epub-bridge.js
 * EPUB Bridge for RSVP Reader
 */

const EpubBridge = {
    book: null,
    chapters: [],
    currentChapterHref: null,

    onChapterReady: null,
    onMetadataReady: null,

    init: function () {
        console.log('EpubBridge Initialized');
    },

    loadBook: function (fileData) {
        if (!window.ePub) {
            alert('Epub.js library not loaded.');
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

        Promise.all([this.book.loaded.navigation, this.book.loaded.spine])
            .then(([nav, spine]) => {
                const tocMap = {};
                const walkToc = (items) => {
                    items.forEach((item) => {
                        const clean = item.href.split('#')[0];
                        tocMap[clean] = item.label.trim();
                        if (item.subitems) walkToc(item.subitems);
                    });
                };
                if (nav.toc) walkToc(nav.toc);

                this.chapters = [];
                let currentGroup = null;

                this.book.spine.each((item) => {
                    const href = item.href;
                    const label = tocMap[href];

                    if (label) {
                        currentGroup = {
                            label: label,
                            href: href,
                            spineHrefs: [href],
                        };
                        this.chapters.push(currentGroup);
                    } else {
                        if (!currentGroup) {
                            currentGroup = {
                                label: 'Intro / Cover',
                                href: href,
                                spineHrefs: [],
                            };
                            this.chapters.push(currentGroup);
                        }
                        currentGroup.spineHrefs.push(href);
                    }
                });

                const event = new CustomEvent('epubChaptersLoaded', {
                    detail: this.chapters,
                });
                document.dispatchEvent(event);
            })
            .catch((err) => {
                console.error('Error loading structure:', err);
                alert('Error reading book structure.');
            });
    },

    loadChapter: async function (groupHref) {
        if (!this.book) return;
        this.currentChapterHref = groupHref;

        const group = this.chapters.find((c) => c.href === groupHref);
        if (!group) {
            console.error('Chapter group not found:', groupHref);
            return;
        }

        try {
            const promises = group.spineHrefs.map((href) => this._loadSingleSpineItem(href));
            const contents = await Promise.all(promises);

            const fullContent = contents.join(' ');

            if (this.onChapterReady) {
                this.onChapterReady(fullContent || ' ');
            }
        } catch (e) {
            console.error('Error loading merged chapter:', e);
            alert('Error loading chapter parts.');
        }
    },

    _loadSingleSpineItem: async function (href) {
        const cleanHref = href.split('#')[0];
        const item = this.book.spine.get(cleanHref);
        if (!item) return '';

        const doc = await item.load(this.book.load.bind(this.book));

        let body = doc.querySelector ? doc.querySelector('body') : null;
        if (!body && doc.getElementsByTagName) {
            body = doc.getElementsByTagName('body')[0];
        }

        const serializer = new XMLSerializer();
        if (body) {
            return serializer.serializeToString(body);
        } else {
            return serializer.serializeToString(doc.documentElement || doc);
        }
    },

    findPhraseIndex: function (wordsArray, phrase) {
        if (!phrase || phrase.trim().length === 0) return -1;

        const rawTokens = phrase.trim().split(/\s+/);

        const targetTokens = rawTokens
            .map((t) => t.toLowerCase().replace(/[^\wáéíóúñü]/g, ''))
            .filter((t) => t.length > 0);

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
                    if (i + offset >= wordsArray.length) {
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

    getChapterIndexByHref: function (href) {
        return this.chapters.findIndex((c) => c.href === href);
    },

    getPreviousChapter: function () {
        const idx = this.getChapterIndexByHref(this.currentChapterHref);
        if (idx > 0) return this.chapters[idx - 1].href;
        return null;
    },

    getNextChapter: function () {
        const idx = this.getChapterIndexByHref(this.currentChapterHref);
        if (idx !== -1 && idx < this.chapters.length - 1) return this.chapters[idx + 1].href;
        return null;
    },
};
