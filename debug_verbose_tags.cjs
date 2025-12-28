const fs = require('fs');
const content = fs.readFileSync('c:\\dev\\prumo_ai\\src\\components\\AdminPanel.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
for (let i = 1133; i < 1833; i++) {
    let line = lines[i];
    let matches = line.matchAll(/<(div|form)|<\/(div|form)/g);
    for (const match of matches) {
        let full = match[0];
        let tag = match[1] || match[2];
        if (full.startsWith('</')) {
            if (stack.length === 0) {
                console.log(`L${i + 1}: Extra closing </${tag}>`);
            } else {
                let last = stack.pop();
                console.log(`L${i + 1}: POP </${tag}> matched <${last.tag}> from L${last.line}. Stack size: ${stack.length}`);
                if (last.tag !== tag) {
                    console.log(`!! Mismatch at L${i + 1}`);
                }
            }
        } else {
            if (line.includes('/>') && line.indexOf(full) < line.indexOf('/>')) {
                // Ignore self-closing
            } else {
                stack.push({ tag, line: i + 1 });
                console.log(`L${i + 1}: PUSH <${tag}>. Stack size: ${stack.length}`);
            }
        }
    }
}
console.log('Final stack count:', stack.length);
stack.forEach(s => console.log(`  Still open: <${s.tag}> from L${s.line}`));
