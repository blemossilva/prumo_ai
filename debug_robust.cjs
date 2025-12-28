const fs = require('fs');
const content = fs.readFileSync('c:\\dev\\prumo_ai\\src\\components\\AdminPanel.tsx', 'utf8');

let braces = 0;
let parens = 0;
let state = 'normal';
let line = 1;
let quoteChar = '';

for (let i = 0; i < content.length; i++) {
    let char = content[i];
    let next = content[i + 1];

    if (state === 'normal') {
        if (char === '/' && next === '/') {
            state = 'comment';
            i++;
        } else if (char === '/' && next === '*') {
            state = 'multiline_comment';
            i++;
        } else if (char === "'" || char === '"' || char === '`') {
            state = 'string';
            quoteChar = char;
        } else if (char === '{') {
            braces++;
        } else if (char === '}') {
            braces--;
        } else if (char === '(') {
            parens++;
        } else if (char === ')') {
            parens--;
        }
    } else if (state === 'comment') {
        if (char === '\n') state = 'normal';
    } else if (state === 'multiline_comment') {
        if (char === '*' && next === '/') {
            state = 'normal';
            i++;
        }
    } else if (state === 'string') {
        if (char === '\\') {
            i++;
        } else if (char === quoteChar) {
            state = 'normal';
        } else if (quoteChar === '`' && char === '$' && next === '{') {
            // Braces inside template literals count
            braces++;
            i++;
        }
    }

    if (char === '\n') {
        line++;
        if (line >= 1130 && line <= 1845) {
            process.stdout.write(`${line}: ${braces}/${parens}\n`);
        }
    }
}
