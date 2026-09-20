const fs = require('fs');
const path = 'src/components/ProductCard.tsx';
let content = fs.readFileSync(path, 'utf8');

const regexContainer = /<div className="mt-1\.5 flex items-center justify-between gap-1 flex-wrap min-w-0">\s*<div className="min-w-0 flex-1">/g;

const replaceWith = `<div className="mt-auto pt-2 flex flex-col gap-2 w-full">
          {/* Price Block */}
          <div className="min-w-0 flex-1">`;

content = content.replace(regexContainer, replaceWith);

const oldButtonWrapper = `<div className="shrink-0 ml-auto">`;
const newButtonWrapper = `<div className="w-full">`;
content = content.replace(new RegExp(oldButtonWrapper, 'g'), newButtonWrapper);

const oldSoldOut = `className="h-7 rounded-full px-2.5 text-[11px] font-bold opacity-60 cursor-not-allowed"`;
const newSoldOut = `className="h-8 w-full rounded-full px-2.5 text-[11px] font-bold opacity-60 cursor-not-allowed"`;
content = content.replace(new RegExp(oldSoldOut.replace('[', '\\[').replace(']', '\\]'), 'g'), newSoldOut);

const oldCounterWrapper = `<div className="flex items-center gap-0.5 rounded-full border border-primary/40 bg-primary/10 dark:bg-primary/20 p-0.5 shadow-2xs">`;
const newCounterWrapper = `<div className="flex w-full items-center justify-between rounded-full border border-primary/40 bg-primary/10 dark:bg-primary/20 p-0.5 shadow-2xs">`;
content = content.replace(new RegExp(oldCounterWrapper.replace('/', '\\/').replace('/', '\\/').replace('/', '\\/'), 'g'), newCounterWrapper);

const oldInput = `className="w-6.5 sm:w-7 bg-transparent text-center text-[11px] sm:text-xs font-black font-mono outline-none text-primary dark:text-primary-foreground select-all p-0 leading-none"`;
const newInput = `className="w-full min-w-0 flex-1 bg-transparent text-center text-[11px] sm:text-xs font-black font-mono outline-none text-primary dark:text-primary-foreground select-all p-0 leading-none"`;
content = content.replace(new RegExp(oldInput.replace('[', '\\[').replace(']', '\\]').replace('[', '\\[').replace(']', '\\]'), 'g'), newInput);

const oldAdd = `className="h-7 rounded-full px-3 text-xs shadow-xs hover:shadow-md transition-all active:scale-95 group-hover:bg-primary/90"`;
const newAdd = `className="h-8 w-full rounded-full px-3 text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-95 group-hover:bg-primary/90"`;
content = content.replace(new RegExp(oldAdd, 'g'), newAdd);


fs.writeFileSync(path, content);
console.log("Card layout updated.");
