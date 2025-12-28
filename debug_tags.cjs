const fs = require('fs');
const content = fs.readFileSync('c:\\dev\\prumo_ai\\src\\components\\AdminPanel.tsx', 'utf8');

let lineNum = 1;
let tagStack = [];

const regex = /<(\/)?([a-z0-9]+)(\s|>)/gi;

let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let currentLineNum = i + 1;

    let match;
    while ((match = regex.exec(line)) !== null) {
        let isClosing = !!match[1];
        let tagName = match[2];

        // Skip self-closing tags (simplified)
        if (line[regex.lastIndex - 1] === '/' && line[regex.lastIndex] === '>') continue;
        if (tagName === 'img' || tagName === 'input' || tagName === 'br' || tagName === 'hr') continue;

        if (isClosing) {
            if (tagStack.length === 0) {
                if (currentLineNum >= 1134 && currentLineNum <= 1840) {
                    console.log(`Line ${currentLineNum}: Unexpected closing tag </${tagName}>`);
                }
            } else {
                let lastTag = tagStack.pop();
                if (lastTag.name !== tagName) {
                    if (currentLineNum >= 1134 && currentLineNum <= 1840) {
                        console.log(`Line ${currentLineNum}: Mismatched closing tag </${tagName}> (expected </${lastTag.name}> opened at line ${lastTag.line})`);
                    }
                }
            }
        } else {
            tagStack.push({ name: tagName, line: currentLineNum });
        }
    }

    if (currentLineNum === 1134) {
        console.log(`--- Starting Agents Tab (Line 1134) --- Tag Stack Size: ${tagStack.length}`);
        tagStack.forEach(t => console.log(`  Open: <${t.name}> at line ${t.line}`));
    }
    if (currentLineNum === 1834) {
        console.log(`--- Ending Agents Tab (Line 1834) --- Tag Stack Size: ${tagStack.length}`);
        tagStack.forEach(t => console.log(`  Still Open: <${t.name}> at line ${t.line}`));
    }
}
