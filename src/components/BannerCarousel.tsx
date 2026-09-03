import { useEffect, useState } from "react";
import type { Banner } from "@/lib/types";

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 4000);
    return () => clearInterval(id);
  }, [count, paused]);

  useEffect(() => {
    if (index > count - 1) setIndex(0);
  }, [count, index]);

  if (count === 0) return null;

  let startX = 0;
  function onTouchStart(e: React.TouchEvent) {
    startX = e.touches[0]?.clientX ?? 0;
    setPaused(true);
  }
  function onTouchEnd(e: React.TouchEvent) {
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const dx = endX - startX;
    if (Math.abs(dx) > 40) {
      setIndex((i) => (dx < 0 ? (i + 1) % count : (i - 1 + count) % count));
    }
    setPaused(false);
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((b) => (
          <div key={b.id} className="relative w-full shrink-0">
            <img src={b.image_url} alt={b.title} className="h-44 w-full object-cover md:h-64" />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-foreground/80 to-transparent p-4 text-background">
              <p className="font-display text-lg font-bold">{b.title}</p>
              {b.subtitle && <p className="text-xs opacity-90">{b.subtitle}</p>}
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Show banner ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-background" : "w-1.5 bg-background/60"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
