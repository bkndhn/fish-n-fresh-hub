const fs = require('fs');
const path = 'src/routes/_authenticated/admin/products.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /<\/div>\s*<\/div>\s*\)\}\s*<\/DialogContent>\s*<\/Dialog>/,
  `            </div>
          </div>
        </DialogContent>
      </Dialog>`
);

fs.writeFileSync(path, content);
console.log('Fixed brace using regex');
