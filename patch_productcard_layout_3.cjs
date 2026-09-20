const fs = require('fs');
const path = 'src/components/ProductCard.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldCounterWrapper = \`<div className="flex items-center gap-0.5 rounded-full border border-primary/40 bg-primary/10 dark:bg-primary/20 p-0.5 shadow-2xs">\`;
const newCounterWrapper = \`<div className="flex w-full justify-between items-center gap-0.5 rounded-full border border-primary/40 bg-primary/10 dark:bg-primary/20 p-0.5 shadow-2xs">\`;
content = content.replace(oldCounterWrapper, newCounterWrapper);

const oldInput = \`className="w-6.5 sm:w-7 bg-transparent text-center text-[11px] sm:text-xs font-black font-mono outline-none text-primary dark:text-primary-foreground select-all p-0 leading-none"\`;
const newInput = \`className="w-full min-w-0 flex-1 bg-transparent text-center text-[11px] sm:text-xs font-black font-mono outline-none text-primary dark:text-primary-foreground select-all p-0 leading-none"\`;
content = content.replace(oldInput, newInput);

const oldAdd = \`className="h-7 rounded-full px-3 text-xs shadow-xs hover:shadow-md transition-all active:scale-95 group-hover:bg-primary/90"\`;
const newAdd = \`className="h-8 w-full rounded-full px-3 text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-95 group-hover:bg-primary/90"\`;
content = content.replace(oldAdd, newAdd);

fs.writeFileSync(path, content);
console.log("Fixed missing wrappers.");
