const PARAGRAPH_TOKEN = '___PB___';

/**
 * Detects Markdown syntax
 */
function isMarkdown(text) {
    const mdRegex = /(\*\*|__|##|^>|\[.*\]\(.*\)|`)/m;
    return mdRegex.test(text);
}

/**
 * Searches for a vowel near the center and cuts after it,
 * respecting diphthongs (does not cut if there are two adjacent vowels).
 */
function findBetterSplitPoint(text) {
    const len = text.length;
    const mid = Math.floor(len / 2);

    if (len < 6) return mid;

    const searchRange = 4;
    const start = Math.max(1, mid - searchRange);
    const end = Math.min(len - 2, mid + searchRange);

    const vowels = 'aeiouáéíóúüAEIOUÁÉÍÓÚÜàèìòùÀÈÌÒÙäëïöüÄËÏÖÜâêîôûÂÊÎÔÛãõÃÕ';
    const isV = (char) => vowels.includes(char);

    for (let offset = 0; offset <= searchRange; offset++) {
        const candidates = [mid + offset, mid - offset];

        for (let idx of candidates) {
            if (idx >= start && idx <= end) {
                const char = text[idx];
                const nextChar = text[idx + 1];

                if (isV(char) && !isV(nextChar)) {
                    return idx + 1;
                }
            }
        }
    }

    return mid;
}

/**
 * Receives a "raw word" (split by spaces) and returns an array of 1 or more RSVP word objects.
 * Handles:
 * - Compound words: "physico-chemical" -> ["physico-", "chemical"]
 * - Dates (Protected): "2024-01-01" -> ["2024-01-01"]
 * - URLs (Protected): "site.com/page" -> ["site.com/page"]
 * - Long words (>16 chars): Splits into phonetic chunks.
 */
function smartSplit(rawWord) {
    if (rawWord === PARAGRAPH_TOKEN) return [{ text: rawWord, type: 'break' }];

    const isUrl = /^(http|https|www)|\.(com|net|org|io|cl|gov)\b/i.test(rawWord);
    const isDate = /^\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}$/.test(rawWord);
    const isNumberRange = /^[\d\-\.\,]+$/.test(rawWord);

    if (isUrl || isDate || isNumberRange) {
        return [{ text: rawWord, type: 'word' }];
    }

    const hasNaturalSeparator = /[-—–_\/]/.test(rawWord);
    const MAX_LEN = 16;

    if (!hasNaturalSeparator && rawWord.length > MAX_LEN) {
        const splitIdx = findBetterSplitPoint(rawWord);

        const part1 = rawWord.slice(0, splitIdx) + '-';
        const part2 = rawWord.slice(splitIdx);

        return [
            { text: part1, type: 'word' },
            { text: part2, type: 'word' },
        ];
    }

    const parts = [];
    let buffer = '';

    for (let i = 0; i < rawWord.length; i++) {
        const char = rawWord[i];
        const isSeparator = /[-—–_\/]/.test(char);

        if (isSeparator) {
            buffer += char;

            if (i < rawWord.length - 1) {
                parts.push(buffer);
                buffer = '';
            }
        } else {
            buffer += char;
        }
    }

    if (buffer.length > 0) {
        parts.push(buffer);
    }

    return parts.map((p) => ({ text: p, type: 'word' }));
}

/**
 * Main parser orchestrator
 */
function parseContent(rawText) {
    if (!rawText) return [];

    if (isMarkdown(rawText) && typeof marked !== 'undefined') {
        const html = marked.parse(rawText);
        return parseHTMLToRSVP(html);
    }

    const textWithTokens = rawText.replace(/\n\s*\n/g, ` ${PARAGRAPH_TOKEN} `).replace(/\n/g, ` ${PARAGRAPH_TOKEN} `);

    const rawWords = textWithTokens.split(/\s+/).filter((w) => w.length > 0);
    return rawWords.flatMap((w) => smartSplit(w));
}

/**
 * Parses HTML string into RSVP word objects preserving formatting.
 */
function parseHTMLToRSVP(htmlString) {
    if (!htmlString || htmlString.trim().length === 0) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    let words = [];

    function walk(node, style) {
        if (node.nodeType === Node.TEXT_NODE) {
            const rawParts = node.textContent.split(/\s+/).filter((w) => w.length > 0);

            rawParts.forEach((raw) => {
                const tokens = smartSplit(raw);
                tokens.forEach((t) => {
                    words.push({ ...t, ...style });
                });
            });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName;
            const isBlock = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE', 'BR'].includes(tagName);

            if (isBlock && words.length > 0 && words[words.length - 1].type !== 'break') {
                words.push({ text: PARAGRAPH_TOKEN, type: 'break' });
            }

            if (tagName === 'LI') {
                let bullet = '•';
                const parent = node.parentElement;

                if (parent && parent.tagName === 'OL') {
                    let index = 1;
                    let sibling = node.previousElementSibling;
                    while (sibling) {
                        if (sibling.tagName === 'LI') index++;
                        sibling = sibling.previousElementSibling;
                    }
                    bullet = `${index}.`;
                }

                words.push({
                    text: bullet,
                    ...style,
                    bold: true,
                    type: 'word',
                });
            }

            let newStyle = { ...style };
            if (['STRONG', 'B'].includes(tagName)) newStyle.bold = true;
            if (['EM', 'I'].includes(tagName)) newStyle.italic = true;

            if (/^H[1-6]$/.test(tagName)) {
                newStyle.header = true;
                newStyle.headerLevel = parseInt(tagName.substring(1));
            }

            node.childNodes.forEach((child) => walk(child, newStyle));

            if (isBlock && words.length > 0 && words[words.length - 1].type !== 'break') {
                words.push({ text: PARAGRAPH_TOKEN, type: 'break' });
            }
        }
    }

    walk(doc.body, {});
    return words;
}

/**
 * Renders a word object into the container with STYLES and PIVOT.
 */
function renderWord(wordObj, outputElement) {
    if (!outputElement) return;

    if (!outputElement.hasChildNodes() || outputElement.children.length !== 3) {
        outputElement.innerHTML = `
            <div class="part-left"></div>
            <div class="pivot"></div>
            <div class="part-right"></div>
        `;
    }

    const leftEl = outputElement.children[0];
    const pivotEl = outputElement.children[1];
    const rightEl = outputElement.children[2];

    const wordText = typeof wordObj === 'string' ? wordObj : wordObj.text;

    const isBreak = (wordObj && wordObj.type === 'break') || wordText === PARAGRAPH_TOKEN;

    outputElement.className = 'word-container';

    if (isBreak) {
        leftEl.textContent = '';
        pivotEl.textContent = '¶';
        pivotEl.className = 'pivot paragraph-symbol';
        rightEl.textContent = '';
        return;
    } else {
        if (pivotEl.classList.contains('paragraph-symbol')) {
            pivotEl.classList.remove('paragraph-symbol');
        }
    }

    if (typeof wordObj === 'object') {
        if (wordObj.bold) outputElement.classList.add('is-bold');
        if (wordObj.italic) outputElement.classList.add('is-italic');
        if (wordObj.header) {
            if (wordObj.headerLevel === 1) outputElement.classList.add('is-h1');
            else if (wordObj.headerLevel === 2) outputElement.classList.add('is-h2');
            else outputElement.classList.add('is-h3');
        }
    }

    const regex = /^([^\wáéíóúÁÉÍÓÚñÑüÜ]*)([\wáéíóúÁÉÍÓÚñÑüÜ\-\']+)([^\wáéíóúÁÉÍÓÚñÑüÜ]*)$/;
    const match = wordText.match(regex);
    let prefix = '',
        core = wordText,
        suffix = '';

    if (match) {
        prefix = match[1];
        core = match[2];
        suffix = match[3];
    }

    const len = core.length;
    let pivotIdx = 0;

    if (len > 1) {
        pivotIdx = Math.floor((len - 1) / 2);
    }

    const coreLeft = core.slice(0, pivotIdx);
    const pivotChar = core[pivotIdx] || '';
    const coreRight = core.slice(pivotIdx + 1);

    if (len === 0 && wordText.length > 0) {
        const mid = Math.floor(wordText.length / 2);
        leftEl.textContent = wordText.slice(0, mid);
        pivotEl.textContent = wordText[mid];
        rightEl.textContent = wordText.slice(mid + 1);
        return;
    }

    leftEl.textContent = prefix + coreLeft;
    pivotEl.textContent = pivotChar;
    rightEl.textContent = coreRight + suffix;
}

/**
 * Shows a temporary toast message.
 */
let toastTimer;
function showToast(msg, toastElement) {
    if (!toastElement) return;
    toastElement.textContent = msg;
    toastElement.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastElement.classList.remove('show'), 1000);
}
