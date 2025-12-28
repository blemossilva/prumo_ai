const fs = require('fs');
const content = fs.readFileSync('c:\\dev\\prumo_ai\\src\\components\\AdminPanel.tsx', 'utf8');

let lineNum = 1;
let tagStack = [];

const regex = /<(\/)?([A-Za-z0-9]+)(\s|>)/gi;

let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let currentLineNum = i + 1;

    let match;
    while ((match = regex.exec(line)) !== null) {
        let isClosing = !!match[1];
        let tagName = match[2];

        // Skip some known self-closing
        if (tagName === 'img' || tagName === 'input' || tagName === 'br' || tagName === 'hr') continue;

        // Check for />
        let afterTag = line.substring(regex.lastIndex);
        let firstGreater = afterTag.indexOf('>');
        let isSelfClosing = false;
        if (firstGreater !== -1) {
            let tagEnd = afterTag.substring(0, firstGreater + 1);
            if (tagEnd.includes('/>')) isSelfClosing = true;
        }

        if (!isClosing && !isSelfClosing) {
            tagStack.push({ name: tagName, line: currentLineNum });
        } else if (isClosing) {
            if (tagStack.length > 0) {
                tagStack.pop();
            }
        }
    }

    if (currentLineNum === 1165) {
        console.log(`--- Starting Modal (Line 1165) --- Stack Size: ${tagStack.length}`);
    }
    if (currentLineNum === 1769) {
        console.log(`--- Ending Modal (Line 1769) --- Stack Size: ${tagStack.length}`);
        tagStack.forEach(t => console.log(`  Still Open: <${t.name}> at line ${t.line}`));
    }
}
