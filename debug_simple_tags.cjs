const fs = require('fs');
const content = fs.readFileSync('c:\\dev\\prumo_ai\\src\\components\\AdminPanel.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
for (let i = 1133; i < 1833; i++) {
    let line = lines[i];
    // Very simple regex for div and form
    let matches = line.matchAll(/<(div|form)|<\/(div|form)/g);
    for (const match of matches) {
        let full = match[0];
        let tag = match[1] || match[2];
        if (full.startsWith('</')) {
            if (stack.length === 0) {
                console.log(`L${i + 1}: Extra closing </${tag}>`);
            } else {
                let last = stack.pop();
                if (last.tag !== tag) {
                    console.log(`L${i + 1}: Mismatch. Expected </${last.tag}> (from L${last.line}), got </${tag}>`);
                }
            }
        } else {
            // Check for self-closing in the same line (simple check)
            if (line.includes('/>') && line.indexOf(full) < line.indexOf('/>')) {
                // Ignore self-closing
            } else {
                stack.push({ tag, line: i + 1 });
            }
        }
    }
}

console.log('Final stack:', stack);
