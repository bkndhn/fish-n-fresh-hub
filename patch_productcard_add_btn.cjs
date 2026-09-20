const fs = require('fs');
const path = 'src/components/ProductCard.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /className="h-7 sm:h-7\.5 rounded-full px-2\.5 xs:px-3 text-\[11px\] xs:text-xs font-bold shadow-2xs hover:shadow-xs active:scale-95 transition-all"/;
const replacement = `className="h-8 w-full rounded-full px-2.5 text-xs font-bold shadow-2xs hover:shadow-xs active:scale-95 transition-all"`;

content = content.replace(regex, replacement);

fs.writeFileSync(path, content);
console.log("Updated Add button class.");
