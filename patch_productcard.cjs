const fs = require('fs');
const path = 'src/components/ProductCard.tsx';
let content = fs.readFileSync(path, 'utf8');

const anchor1 = `<Link
          to="/product/$id"
          params={{ id: product.id }}
          preload="intent"
          className="block aspect-square overflow-hidden bg-muted"
        >`;

const replace1 = `{s?.enable_product_details !== false ? (
        <Link
          to="/product/$id"
          params={{ id: product.id }}
          preload="intent"
          className="block aspect-square overflow-hidden bg-muted"
        >
          {product.image_url ? (
            <img
              src={optimizeImageUrl(product.image_url, { width: 500, quality: 75 })}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover transition-transform duration-300",
                !isOutOfStock && "group-hover:scale-105",
                isOutOfStock && "grayscale-30"
              )}
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted/50 text-muted-foreground">
              <Fish className="size-8 opacity-30" />
            </div>
          )}
        </Link>
      ) : (
        <div className="block aspect-square overflow-hidden bg-muted">
          {product.image_url ? (
            <img
              src={optimizeImageUrl(product.image_url, { width: 500, quality: 75 })}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover transition-transform duration-300",
                !isOutOfStock && "group-hover:scale-105",
                isOutOfStock && "grayscale-30"
              )}
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted/50 text-muted-foreground">
              <Fish className="size-8 opacity-30" />
            </div>
          )}
        </div>
      )}`;

// We need to replace the entire block for the image, let's just do a manual replace using regex or simpler blocks

const oldImageBlock = `<Link
          to="/product/$id"
          params={{ id: product.id }}
          preload="intent"
          className="block aspect-square overflow-hidden bg-muted"
        >
          {product.image_url ? (
            <img
              src={optimizeImageUrl(product.image_url, { width: 500, quality: 75 })}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover transition-transform duration-300",
                !isOutOfStock && "group-hover:scale-105",
                isOutOfStock && "grayscale-30"
              )}
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted/50 text-muted-foreground">
              <Fish className="size-8 opacity-30" />
            </div>
          )}
        </Link>`;

content = content.replace(oldImageBlock, replace1);

const oldTitleBlock = `<Link
          to="/product/$id"
          params={{ id: product.id }}
          preload="intent"
          className="block group/title"
        >
          <h3 className="line-clamp-1 text-sm font-semibold group-hover/title:text-primary transition-colors">{product.name}</h3>
          {product.name_tamil && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{product.name_tamil}</p>
          )}
        </Link>`;

const replace2 = `{s?.enable_product_details !== false ? (
        <Link
          to="/product/$id"
          params={{ id: product.id }}
          preload="intent"
          className="block group/title"
        >
          <h3 className="line-clamp-1 text-sm font-semibold group-hover/title:text-primary transition-colors">{product.name}</h3>
          {product.name_tamil && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{product.name_tamil}</p>
          )}
        </Link>
      ) : (
        <div className="block group/title">
          <h3 className="line-clamp-1 text-sm font-semibold transition-colors">{product.name}</h3>
          {product.name_tamil && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{product.name_tamil}</p>
          )}
        </div>
      )}`;

content = content.replace(oldTitleBlock, replace2);

fs.writeFileSync(path, content);
console.log('ProductCard patched successfully.');
