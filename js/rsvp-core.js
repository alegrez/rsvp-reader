const PARAGRAPH_TOKEN = "___PB___";

/**
 * Detects Markdown syntax
 */
function isMarkdown(text) {
    const mdRegex = /(\*\*|__|##|^>|\[.*\]\(.*\)|`)/m;
    return mdRegex.test(text);
}

/**
 * Main parser: Orchestrates parsing based on content type.
 */
function parseContent(rawText) {
    if (!rawText) return [];

    if (isMarkdown(rawText) && typeof marked !== 'undefined') {
        const html = marked.parse(rawText);
        return parseHTMLToRSVP(html);
    }

    const textWithTokens = rawText.replace(/\n\s*\n/g, ` ${PARAGRAPH_TOKEN} `)
                                  .replace(/\n/g, ` ${PARAGRAPH_TOKEN} `);
    
    return textWithTokens.split(/\s+/).filter(w => w.length > 0).map(w => ({
        text: w,
        type: w === PARAGRAPH_TOKEN ? 'break' : 'word'
    }));
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
            const parts = node.textContent.split(/\s+/).filter(w => w.length > 0);
            parts.forEach(p => {
                words.push({ text: p, ...style, type: 'word' });
            });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName;
            const isBlock = ['P','DIV','H1','H2','H3','H4','LI','BLOCKQUOTE','BR'].includes(tagName);
            
            if (isBlock && words.length > 0 && words[words.length-1].type !== 'break') {
                words.push({ text: PARAGRAPH_TOKEN, type: 'break' });
            }

            if (tagName === 'LI') {
                let bullet = "•";
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
                    type: 'word' 
                });
            }

            let newStyle = { ...style };
            if (['STRONG', 'B'].includes(tagName)) newStyle.bold = true;
            if (['EM', 'I'].includes(tagName)) newStyle.italic = true;
            
            if (/^H[1-6]$/.test(tagName)) {
                newStyle.header = true;
                newStyle.headerLevel = parseInt(tagName.substring(1));
            }

            node.childNodes.forEach(child => walk(child, newStyle));

            if (isBlock && words.length > 0 && words[words.length-1].type !== 'break') {
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

    const wordText = (typeof wordObj === 'string') ? wordObj : wordObj.text;

    const isBreak = (wordObj && wordObj.type === 'break') || (wordText === PARAGRAPH_TOKEN);

    outputElement.className = 'word-container'; 

    if (isBreak) {
        outputElement.innerHTML = `<div class="part-left"></div><div class="pivot paragraph-symbol">¶</div><div class="part-right"></div>`;
        return;
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
    let prefix = "", core = wordText, suffix = "";
    
    if (match) { 
        prefix = match[1]; 
        core = match[2]; 
        suffix = match[3]; 
    }

    const len = core.length;
    let left = "", piv = "", right = "";
    
    if (len < 2) { 
        piv = core; 
    } else if (len % 2 === 0) {
        const mid2 = len / 2; 
        left = core.slice(0, mid2 - 1); 
        piv = core.slice(mid2 - 1, mid2 + 1); 
        right = core.slice(mid2 + 1);
    } else {
        const mid = Math.floor(len / 2); 
        left = core.slice(0, mid); 
        piv = core[mid]; 
        right = core.slice(mid + 1);
    }
    
    outputElement.innerHTML = `<div class="part-left">${prefix}${left}</div><div class="pivot">${piv}</div><div class="part-right">${right}${suffix}</div>`;
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
