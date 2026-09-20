const fs = require('fs');
const path = 'src/routes/_authenticated/admin/products.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>`,
  `            </div>
          </div>
        </DialogContent>
      </Dialog>`
);

content = content.replace(
  `            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>`,
  `            </div>
          </div>
      </DialogContent>
    </Dialog>`
);


fs.writeFileSync(path, content);
console.log('Fixed brace');
