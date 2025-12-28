const fs = require('fs');
const content = fs.readFileSync('c:\\dev\\prumo_ai\\src\\components\\AdminPanel.tsx', 'utf8');

let lineNum = 1;
let tagStack = [];

// Match any tag name
const regex = /<(\/)?([A-Za-z0-9]+)(\s|>)/gi;

let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let currentLineNum = i + 1;

    let match;
    while ((match = regex.exec(line)) !== null) {
        let isClosing = !!match[1];
        let tagName = match[2];

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
        } else if (isClosing) {
            if (tagStack.length > 0) {
                let last = tagStack.pop();
                if (last.name !== tagName) {
                    // Try to find it in the stack to see if we missed a closer
                    let foundIdx = -1;
                    for (let j = tagStack.length - 1; j >= 0; j--) {
                        if (tagStack[j].name === tagName) {
                            foundIdx = j;
                            break;
                        }
                    }
                    if (foundIdx !== -1) {
                        // We missed some closers!
                        let missed = tagStack.splice(foundIdx);
                        if (currentLineNum >= 1165 && currentLineNum <= 1840) {
                            console.log(`L${currentLineNum}: Closing </${tagName}> but found <${missed[missed.length - 1].name}> L${missed[missed.length - 1].line} on top. Missed ${missed.length - 1} closers!`);
                            missed.slice(0, -1).forEach(m => console.log(`  Missed closer for <${m.name}> L${m.line}`));
                        }
                    }
                }
            }
        }
    }
}

console.log(`Final Tag Stack Size: ${tagStack.length}`);
tagStack.forEach(t => console.log(`  Still Open: <${t.name}> at line ${t.line}`));
