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

        // Skip self-closing tags
        if (line[regex.lastIndex - 1] === '/' && line[regex.lastIndex] === '>') continue;
        if (tagName === 'img' || tagName === 'input' || tagName === 'br' || tagName === 'hr') continue;

        if (isClosing) {
            if (tagStack.length > 0) {
                tagStack.pop();
            }
        } else {
            tagStack.push({ name: tagName, line: currentLineNum });
        }
    }

    if (currentLineNum === 1836) {
        console.log(`--- Starting Groups Tab (Line 1836) --- Tag Stack Size: ${tagStack.length}`);
    }
    if (currentLineNum >= 2050) {
        if (currentLineNum === 2062) {
            console.log(`--- End of File (Line 2062) --- Tag Stack Size: ${tagStack.length}`);
            tagStack.forEach(t => console.log(`  Still Open: <${t.name}> at line ${t.line}`));
        }
    }
}
