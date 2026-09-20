const fs = require('fs');
const path = 'src/routes/product.$id.tsx';
let content = fs.readFileSync(path, 'utf8');

const imageBlock = `<div className="overflow-hidden rounded-3xl border border-border bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="aspect-square w-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
              }}
            />
          ) : (
            <div className="aspect-square w-full flex items-center justify-center bg-muted/60 text-muted-foreground">
              <Fish className="size-16 opacity-30" />
            </div>
          )}
        </div>`;

const injectGallery = `<div className="flex flex-col gap-3">
          {/* Main Zoomable Image Viewer */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-muted group cursor-crosshair">
            {product.image_url || (product.gallery_urls && product.gallery_urls.length > 0) ? (
              <img
                src={activeImage || product.image_url || product.gallery_urls[0]}
                alt={product.name}
                className="aspect-square w-full object-cover transition-transform duration-300 ease-out group-hover:scale-150 origin-center"
                onError={(e) => {
                  e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  e.currentTarget.style.transformOrigin = \`\${x}% \${y}%\`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transformOrigin = "center center";
                }}
              />
            ) : (
              <div className="aspect-square w-full flex items-center justify-center bg-muted/60 text-muted-foreground">
                <Fish className="size-16 opacity-30" />
              </div>
            )}
          </div>
          
          {/* Thumbnails Row */}
          {(product.gallery_urls?.length > 0 || product.image_url) && (
            <div className="flex gap-2 overflow-x-auto pb-1 snap-x scrollbar-hide">
              {[product.image_url, ...(product.gallery_urls || [])].filter(Boolean).map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(url)}
                  className={\`relative shrink-0 snap-center size-20 rounded-xl overflow-hidden border-2 transition-all \${activeImage === url || (!activeImage && i===0) ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-border opacity-70 hover:opacity-100 hover:border-primary/50'}\`}
                >
                  <img src={url} alt={\`Thumbnail \${i}\`} className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>`;

content = content.replace(imageBlock, injectGallery);

// Add activeImage state
content = content.replace(
  'const [sizeChartOpen, setSizeChartOpen] = useState(false);',
  'const [sizeChartOpen, setSizeChartOpen] = useState(false);\n  const [activeImage, setActiveImage] = useState<string | null>(null);'
);

// Add rich_description below description
const descBlock = `{product.description && (
          <div className="mt-8 rounded-2xl bg-muted/30 p-4 sm:p-6 border border-border/40">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" /> About this product
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{product.description}</p>
          </div>
        )}`;

const injectRichDesc = `{product.description && (
          <div className="mt-8 rounded-2xl bg-muted/30 p-4 sm:p-6 border border-border/40">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" /> About this product
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{product.description}</p>
            {product.rich_description && (
              <div className="mt-4 pt-4 border-t border-border/50 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {product.rich_description}
              </div>
            )}
          </div>
        )}`;

content = content.replace(descBlock, injectRichDesc);


// Check if related products are shown. "layoutConfig.showRelatedProducts" is there, let's make sure it shows 5 products instead of 3.
content = content.replace(
  'const related = (all ?? []).filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3);',
  'const related = (all ?? []).filter((p) => p.category === product.category && p.id !== product.id).slice(0, 5);'
);

// Change the grid classes for related to fit 5 products.
const relatedGridOld = `<div className="mt-4 grid gap-4 grid-cols-2 sm:grid-cols-3">`;
const relatedGridNew = `<div className="mt-4 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">`;
content = content.replace(relatedGridOld, relatedGridNew);

fs.writeFileSync(path, content);
console.log('product details patched successfully.');
