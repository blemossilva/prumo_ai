const fs = require('fs');
const content = fs.readFileSync('c:\\dev\\prumo_ai\\src\\components\\AdminPanel.tsx', 'utf8');

let braces = 0;
let parens = 0;
let lineNum = 1;

let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let currentLineNum = i + 1;

    for (let char of line) {
        if (char === '{') braces++;
        if (char === '}') braces--;
        if (char === '(') parens++;
        if (char === ')') parens--;
    }

    if (currentLineNum >= 910) {
        console.log(`${currentLineNum}: ${braces}/${parens}`);
    }
}
