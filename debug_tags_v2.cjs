const fs = require('fs');
const content = fs.readFileSync('c:\\dev\\prumo_ai\\src\\components\\AdminPanel.tsx', 'utf8');

const lines = content.split('\n');
const startLine = 1134;
const endLine = 1834;

let stack = [];
let re = /<\/?([a-zA-Z0-9]+)/g;

for (let i = startLine - 1; i < endLine; i++) {
    let line = lines[i];
    let match;
    while ((match = re.exec(line)) !== null) {
        let tag = match[1];
        if (match[0].startsWith('</')) {
            if (stack.length === 0) {
                console.log(`Extra closing tag at line ${i + 1}: </${tag}>`);
            } else {
                let last = stack.pop();
                if (last.tag !== tag) {
                    console.log(`Mismatch at line ${i + 1}: </${tag}> closes <${last.tag}> from line ${last.line}`);
                }
            }
        } else {
            // Check if self-closing
            let rest = line.substring(match.index);
            let closingBracket = rest.indexOf('>');
            if (closingBracket !== -1) {
                let tagBody = rest.substring(0, closingBracket);
                if (tagBody.endsWith('/') || tagBody.includes('/>')) {
                    // Self-closing
                } else {
                    stack.push({ tag, line: i + 1 });
                }
            } else {
                // Multi-line start tag or partial line
                stack.push({ tag, line: i + 1 });
            }
        }
    }
}

console.log(`Remaining tags on stack: ${stack.length}`);
stack.forEach(s => console.log(`  <${s.tag}> from line ${s.line}`));
