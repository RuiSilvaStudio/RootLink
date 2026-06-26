const fs = require('fs');
const path = require('path');

const appDir = '/home/rui/projects/RootLink/rootlink/frontend/app';
const allFiles = [];

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
        } else if (entry.name.endsWith('.tsx')) {
            allFiles.push(fullPath);
        }
    }
}

walk(appDir);

function extractFileContent(filepath) {
    return fs.readFileSync(filepath, 'utf8');
}

function addDarkVariants(content) {
    let changes = [];
    let updated = content;

    const replacements = [
        // text colors
        { find: /text-stone-800(?![^:]*dark:)/g, replace: /text-stone-800/g, dark: 'dark:text-stone-100' },
        { find: /text-stone-500(?![^:]*dark:)/g, replace: /text-stone-500/g, dark: 'dark:text-stone-300' },
        { find: /text-stone-400(?![^:]*dark:)/g, replace: /text-stone-400/g, dark: 'dark:text-stone-500' },
        { find: /text-stone-600(?![^:]*dark:)/g, replace: /text-stone-600/g, dark: 'dark:text-stone-200' },
        { find: /text-stone-300(?![^:]*dark:)/g, replace: /text-stone-300/g, dark: 'dark:text-stone-400' },
        { find: /text-primary-700(?![^:]*dark:)/g, replace: /text-primary-700/g, dark: 'dark:text-primary-300' },
        { find: /text-primary-600(?![^:]*dark:)/g, replace: /text-primary-600/g, dark: 'dark:text-primary-400' },
        { find: /text-primary-400(?![^:]*dark:)/g, replace: /text-primary-400/g, dark: 'dark:text-primary-600' },
        { find: /text-primary-300(?![^:]*dark:)/g, replace: /text-primary-300/g, dark: 'dark:text-primary-400' },
        { find: /text-earth-600(?![^:]*dark:)/g, replace: /text-earth-600/g, dark: 'dark:text-earth-400' },
        { find: /text-blue-600(?![^:]*dark:)/g, replace: /text-blue-600/g, dark: 'dark:text-blue-400' },
        { find: /text-green-600(?![^:]*dark:)/g, replace: /text-green-600/g, dark: 'dark:text-green-400' },
        { find: /text-emerald-700(?![^:]*dark:)/g, replace: /text-emerald-700/g, dark: 'dark:text-emerald-300' },
        { find: /text-amber-700(?![^:]*dark:)/g, replace: /text-amber-700/g, dark: 'dark:text-amber-200' },
        { find: /text-red-700(?![^:]*dark:)/g, replace: /text-red-700/g, dark: 'dark:text-red-300' },
        { find: /text-rust-600(?![^:]*dark:)/g, replace: /text-rust-600/g, dark: 'dark:text-rust-400' },
        { find: /text-sky-600(?![^:]*dark:)/g, replace: /text-sky-600/g, dark: 'dark:text-sky-400' },
        // background colors
        { find: /bg-white(?![^:]*dark:)/g, replace: /bg-white/g, dark: 'dark:bg-stone-900' },
        { find: /bg-stone-100(?![^:]*dark:)/g, replace: /bg-stone-100/g, dark: 'dark:bg-stone-800' },
        { find: /bg-primary-100(?![^:]*dark:)/g, replace: /bg-primary-100/g, dark: 'dark:bg-primary-950/20' },
        { find: /bg-primary-50(?![^:]*dark:)/g, replace: /bg-primary-50/g, dark: 'dark:bg-primary-950/20' },
        { find: /bg-earth-100(?![^:]*dark:)/g, replace: /bg-earth-100/g, dark: 'dark:bg-earth-950/20' },
        { find: /bg-blue-100(?![^:]*dark:)/g, replace: /bg-blue-100/g, dark: 'dark:bg-blue-950/20' },
        { find: /bg-green-100(?![^:]*dark:)/g, replace: /bg-green-100/g, dark: 'dark:bg-green-950/20' },
        { find: /bg-amber-100(?![^:]*dark:)/g, replace: /bg-amber-100/g, dark: 'dark:bg-amber-950/20' },
        { find: /bg-stone-200(?![^:]*dark:)/g, replace: /bg-stone-200/g, dark: 'dark:bg-stone-800' },
        { find: /bg-stone-200/40(?![^:]*dark:)/g, replace: /bg-stone-200/g, dark: 'dark:bg-stone-800/40' },
        { find: /bg-stone-200/60(?![^:]*dark:)/g, replace: /bg-stone-200/g, dark: 'dark:bg-stone-800/60' },
        { find: /bg-stone-200/80(?![^:]*dark:)/g, replace: /bg-stone-200/g, dark: 'dark:bg-stone-800/80' },
        { find: /bg-amber-50/40(?![^:]*dark:)/g, replace: /bg-amber-50/g, dark: 'dark:bg-amber-950/10' },
        { find: /bg-amber-50/40(?![^:]*dark:)/g, replace: /bg-amber-50/g, dark: 'dark:bg-amber-950/40' },
    ];

    for (const rep of replacements) {
        const matches = updated.match(rep.find);
        if (matches) {
            const lines = updated.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (rep.find.test(lines[i])) {
                    let newLine = lines[i];
                    newLine = newLine.replace(rep.find, `$1 ${rep.dark}`);
                    if (newLine !== lines[i]) {
                        changes.push(`${lines[i].trim()} -> ${newLine.trim()}`);
                        lines[i] = newLine;
                        updated = lines.join('\n');
                    }
                }
            }
        }
    }

    return { updated, changes };
}

function processFile(filepath) {
    console.log('\n' + '='.repeat(80));
    console.log('PROCESSING:', filepath);
    console.log('='.repeat(80));
    
    try {
        const content = extractFileContent(filepath);
        const { updated, changes } = addDarkVariants(content);
        
        if (changes.length > 0) {
            console.log('\nCHANGES FOUND:');
            changes.forEach((change, i) => console.log(`  ${i+1}. ${change}`));
            
            console.log('\nFULLY UPDATED CONTENT:');
            console.log(updated);
            
            fs.writeFileSync(filepath, updated);
            console.log('\n✓ FILE UPDATED');
            return true;
        } else {
            console.log('\n✓ NO CHANGES NEEDED');
            return false;
        }
    } catch (err) {
        console.error('ERROR processing', filepath, ':', err.message);
        return false;
    }
}

// Main execution
console.log('Scanning and fixing dark mode variants in page files...');

let processedCount = 0;
let changedCount = 0;

allFiles.forEach(filepath => {
    const filename = path.basename(filepath);
    const isPageFile = filename.includes('page') || 
                      filename === 'page.tsx' ||
                      filename === 'layout.tsx';
    
    if (isPageFile) {
        const changed = processFile(filepath);
        if (changed) changedCount++;
        processedCount++;
    }
});

console.log('\n' + '='.repeat(80));
console.log('SUMMARY:');
console.log('='.repeat(80));
console.log(`Total page files processed: ${processedCount}`);
console.log(`Files requiring changes: ${changedCount}`);
console.log('='.repeat(80));
