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

function fixFile(filepath) {
    try {
        let content = fs.readFileSync(filepath, 'utf8');
        let changes = [];
        let updated = content;
        
        // Fixed for each line to ensure dark: variants
        const lines = updated.split('\n');
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Add dark: variants for text colors
            line = line.replace(/text-stone-800(!)/g, 'text-stone-800 dark:text-stone-100$1');
            line = line.replace(/text-stone-500(!)/g, 'text-stone-500 dark:text-stone-300$1');
            line = line.replace(/text-stone-400(!)/g, 'text-stone-400 dark:text-stone-500$1');
            line = line.replace(/text-stone-600(!)/g, 'text-stone-600 dark:text-stone-200$1');
            line = line.replace(/text-stone-300(!)/g, 'text-stone-300 dark:text-stone-400$1');
            line = line.replace(/text-primary-700(!)/g, 'text-primary-700 dark:text-primary-300$1');
            line = line.replace(/text-primary-600(!)/g, 'text-primary-600 dark:text-primary-400$1');
            line = line.replace(/text-primary-400(!)/g, 'text-primary-400 dark:text-primary-600$1');
            line = line.replace(/text-primary-300(!)/g, 'text-primary-300 dark:text-primary-400$1');
            line = line.replace(/text-earth-600(!)/g, 'text-earth-600 dark:text-earth-400$1');
            line = line.replace(/text-blue-600(!)/g, 'text-blue-600 dark:text-blue-400$1');
            line = line.replace(/text-green-600(!)/g, 'text-green-600 dark:text-green-400$1');
            line = line.replace(/text-emerald-700(!)/g, 'text-emerald-700 dark:text-emerald-300$1');
            line = line.replace(/text-amber-700(!)/g, 'text-amber-700 dark:text-amber-200$1');
            line = line.replace(/text-red-700(!)/g, 'text-red-700 dark:text-red-300$1');
            line = line.replace(/text-rust-600(!)/g, 'text-rust-600 dark:text-rust-400$1');
            line = line.replace(/text-sky-600(!)/g, 'text-sky-600 dark:text-sky-400$1');
            
            // Add dark: variants for background colors
            line = line.replace(/bg-white(!)/g, 'bg-white dark:bg-stone-900$1');
            line = line.replace(/bg-stone-100(!)/g, 'bg-stone-100 dark:bg-stone-800$1');
            line = line.replace(/bg-stone-200(!)/g, 'bg-stone-200 dark:bg-stone-800$1');
            line = line.replace(/bg-primary-100(!)/g, 'bg-primary-100 dark:bg-primary-950/20$1');
            line = line.replace(/bg-primary-50(!)/g, 'bg-primary-50 dark:bg-primary-950/20$1');
            line = line.replace(/bg-earth-100(!)/g, 'bg-earth-100 dark:bg-earth-950/20$1');
            line = line.replace(/bg-blue-100(!)/g, 'bg-blue-100 dark:bg-blue-950/20$1');
            line = line.replace(/bg-green-100(!)/g, 'bg-green-100 dark:bg-green-950/20$1');
            line = line.replace(/bg-amber-100(!)/g, 'bg-amber-100 dark:bg-amber-950/20$1');
            
            // Handle specific patterns with slashes
            line = line.replace(/bg-primary-100(\s|\/)/g, 'bg-primary-100 dark:bg-primary-950/20$1');
            line = line.replace(/text-stone-800(\s|\/)/g, 'text-stone-800 dark:text-stone-100$1');
            
            // Check if we made any changes
            if (line !== lines[i]) {
                changes.push({
                    lineNumber: i + 1,
                    oldLine: lines[i].trim(),
                    newLine: line.trim(),
                    type: 'styling-fix'
                });
                lines[i] = line;
            }
        }
        
        updated = lines.join('\n');
        
        // Write back if we made changes
        if (changes.length > 0) {
            fs.writeFileSync(filepath, updated);
            return changes;
        }
        return null;
    } catch (err) {
        console.error('ERROR processing', filepath, ':', err.message);
        return null;
    }
}

// Main execution
console.log('Scanning and fixing dark mode variants in page files...');

let processedCount = 0;
let changedCount = 0;
const allChanges = [];

allFiles.forEach(filepath => {
    const filename = path.basename(filepath);
    const isPageFile = filename.includes('page') || 
                      filename === 'page.tsx' ||
                      filename === 'layout.tsx';
    
    if (isPageFile) {
        console.log('\n--- Processing:', filename, '---');
        const changes = fixFile(filepath);
        if (changes) {
            changedCount++;
            allChanges.push({
                file: filename,
                changes: changes
            });
        }
        processedCount++;
    }
});

console.log('\n' + '='.repeat(80));
console.log('SUMMARY:');
console.log('='.repeat(80));
console.log(`Total page files processed: ${processedCount}`);
console.log(`Files requiring changes: ${changedCount}`);
console.log('\nDetailed changes:');
allChanges.forEach(({ file, changes }) => {
    console.log(`\n${file} (${changes.length} changes):`);
    changes.forEach(change => {
        console.log(`  Line ${change.lineNumber}: ${change.type}`);
        console.log(`    OLD: ${change.oldLine}`);
        console.log(`    NEW: ${change.newLine}`);
    });
});
console.log('='.repeat(80));
