const fs = require('fs');
const path = 'src/components/ProductCard.tsx';
let content = fs.readFileSync(path, 'utf8');

const anchor = `<div className="mt-1.5 flex items-center justify-between gap-1 flex-wrap min-w-0">
          <div className="min-w-0 flex-1">`;

const replaceWith = `<div className="mt-auto pt-2 flex flex-col gap-2.5 w-full">
          {/* Price Block */}
          <div className="min-w-0 flex-1">`;

// But we need to also replace the button wrapper:
// Old: `<div className="shrink-0 ml-auto">`
// New: `<div className="w-full">`

const oldButtonWrapper = `<div className="shrink-0 ml-auto">`;
const newButtonWrapper = `<div className="w-full">`;

// Old Out of stock button:
// `<Button size="sm" variant="secondary" disabled className="h-7 rounded-full px-2.5 text-[11px] font-bold opacity-60 cursor-not-allowed">Sold Out</Button>`
// New: Add `w-full`
const oldSoldOut = `className="h-7 rounded-full px-2.5 text-[11px] font-bold opacity-60 cursor-not-allowed"`;
const newSoldOut = `className="h-8 w-full rounded-full px-2.5 text-[11px] font-bold opacity-60 cursor-not-allowed"`;

// Old Cart counter wrapper:
// `<div className="flex items-center gap-0.5 rounded-full border border-primary/40 bg-primary/10 dark:bg-primary/20 p-0.5 shadow-2xs">`
const oldCounterWrapper = `<div className="flex items-center gap-0.5 rounded-full border border-primary/40 bg-primary/10 dark:bg-primary/20 p-0.5 shadow-2xs">`;
const newCounterWrapper = `<div className="flex w-full items-center justify-between rounded-full border border-primary/40 bg-primary/10 dark:bg-primary/20 p-0.5 shadow-2xs">`;

// Old input width:
// `className="w-6.5 sm:w-7 bg-transparent text-center text-[11px] sm:text-xs font-black font-mono outline-none text-primary dark:text-primary-foreground select-all p-0 leading-none"`
const oldInput = `className="w-6.5 sm:w-7 bg-transparent text-center text-[11px] sm:text-xs font-black font-mono outline-none text-primary dark:text-primary-foreground select-all p-0 leading-none"`;
const newInput = `className="w-full min-w-0 flex-1 bg-transparent text-center text-[11px] sm:text-xs font-black font-mono outline-none text-primary dark:text-primary-foreground select-all p-0 leading-none"`;

// Old Add Button:
// `<Button size="sm" className="h-7 rounded-full px-3 text-xs shadow-xs hover:shadow-md transition-all active:scale-95 group-hover:bg-primary/90"`
const oldAdd = `className="h-7 rounded-full px-3 text-xs shadow-xs hover:shadow-md transition-all active:scale-95 group-hover:bg-primary/90"`;
const newAdd = `className="h-8 w-full rounded-full px-3 text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-95 group-hover:bg-primary/90"`;

if (content.includes(anchor)) {
    content = content.replace(anchor, replaceWith);
    content = content.replace(oldButtonWrapper, newButtonWrapper);
    content = content.replace(oldSoldOut, newSoldOut);
    content = content.replace(oldCounterWrapper, newCounterWrapper);
    content = content.replace(oldInput, newInput);
    content = content.replace(oldAdd, newAdd);
    fs.writeFileSync(path, content);
    console.log("Card layout updated.");
} else {
    console.log("Anchor not found.");
}
