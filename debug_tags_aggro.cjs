const fs = require('fs');
const content = fs.readFileSync('c:\\dev\\prumo_ai\\src\\components\\AdminPanel.tsx', 'utf8');

let lineNum = 1;
let tagStack = [];

// Match any tag name (including components with caps)
const regex = /<(\/)?([A-Za-z0-9]+)(\s|>)/gi;

let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let currentLineNum = i + 1;

    let match;
    while ((match = regex.exec(line)) !== null) {
        let isClosing = !!match[1];
        let tagName = match[2];

        // Check for self-closing tags like <br />, <hr />, <input />, or <X size={10} />
        // We look for /> before the next tag or end of line
        let afterTag = line.substring(regex.lastIndex);
        let firstGreater = afterTag.indexOf('>');
        let isSelfClosing = false;
        if (firstGreater !== -1) {
            let tagEnd = afterTag.substring(0, firstGreater + 1);
            if (tagEnd.includes('/>')) isSelfClosing = true;
        }

        if (tagName === 'img' || tagName === 'input' || tagName === 'br' || tagName === 'hr' || tagName === 'meta' || tagName === 'link') isSelfClosing = true;

        if (!isClosing && !isSelfClosing) {
            tagStack.push({ name: tagName, line: currentLineNum });
            if (currentLineNum >= 1830 && currentLineNum <= 1840) console.log(`[L${currentLineNum}] Push <${tagName}>. Stack: ${tagStack.length}`);
        } else if (isClosing) {
            if (tagStack.length > 0) {
                let popped = tagStack.pop();
                if (currentLineNum >= 1830 && currentLineNum <= 1840) console.log(`[L${currentLineNum}] Pop </${tagName}> (matched <${popped.name}> L${popped.line}). Stack: ${tagStack.length}`);
            } else {
                if (currentLineNum >= 1830 && currentLineNum <= 1840) console.log(`[L${currentLineNum}] Unexpected </${tagName}>! Stack empty.`);
            }
        }
    }
}

console.log(`Final Tag Stack Size: ${tagStack.length}`);
tagStack.forEach(t => console.log(`  Still Open: <${t.name}> at line ${t.line}`));
