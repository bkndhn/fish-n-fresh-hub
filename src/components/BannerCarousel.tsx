import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Banner } from "@/lib/types";

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartX = useRef(0);
  const currentDragOffset = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const count = banners.length;

  const nextSlide = useCallback(() => {
    if (count <= 1) return;
    setIndex((prev) => (prev + 1) % count);
  }, [count]);

  const prevSlide = useCallback(() => {
    if (count <= 1) return;
    setIndex((prev) => (prev - 1 + count) % count);
  }, [count]);

  // Periodic auto-scroll (every 4.5 seconds)
  useEffect(() => {
    if (count < 2 || isPaused || isDragging) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 4500);
    return () => clearInterval(timer);
  }, [count, isPaused, isDragging, nextSlide]);

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  if (count === 0) return null;

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    setIsDragging(true);
    dragStartX.current = e.touches[0]?.clientX ?? 0;
    currentDragOffset.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0]?.clientX ?? dragStartX.current;
    const diff = currentX - dragStartX.current;
    currentDragOffset.current = diff;
    setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const threshold = 40;
    if (currentDragOffset.current < -threshold) {
      nextSlide();
    } else if (currentDragOffset.current > threshold) {
      prevSlide();
    }
    setDragOffset(0);
    currentDragOffset.current = 0;
    setTimeout(() => setIsPaused(false), 2000);
  };

  // Mouse Drag Handlers (for desktop/laptop smooth experience)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsPaused(true);
    setIsDragging(true);
    dragStartX.current = e.clientX;
    currentDragOffset.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - dragStartX.current;
    currentDragOffset.current = diff;
    setDragOffset(diff);
  };

  const handleMouseUpOrLeave = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const threshold = 40;
    if (currentDragOffset.current < -threshold) {
      nextSlide();
    } else if (currentDragOffset.current > threshold) {
      prevSlide();
    }
    setDragOffset(0);
    currentDragOffset.current = 0;
    setTimeout(() => setIsPaused(false), 2000);
  };

  return (
    <section
      ref={containerRef}
      className="group relative overflow-hidden rounded-3xl shadow-sm select-none w-full max-w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        handleMouseUpOrLeave();
        setIsPaused(false);
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      style={{ touchAction: "pan-y" }}
    >
      <div
        className={`flex ${isDragging ? "transition-none cursor-grabbing" : "transition-transform duration-500 ease-out cursor-grab"}`}
        style={{
          transform: `translateX(calc(-${index * 100}% + ${dragOffset}px))`,
        }}
      >
        {banners.map((b, i) => (
          <div key={b.id || i} className="relative w-full shrink-0">
            <img
              src={b.image_url}
              alt={b.title}
              loading="eager"
              decoding="async"
              className="h-48 w-full object-cover sm:h-56 md:h-72 select-none pointer-events-none"
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=1200";
              }}
            />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/30 to-transparent p-5 text-white">
              <span className="inline-block w-fit rounded-full bg-primary/80 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white mb-1.5">
                Fresh Catch Special
              </span>
              <p className="font-display text-xl sm:text-2xl font-black leading-tight drop-shadow-xs">
                {b.title}
              </p>
              {b.subtitle && (
                <p className="mt-1 text-xs sm:text-sm text-white/90 line-clamp-1 max-w-md">
                  {b.subtitle}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Manual Chevron Left / Right Buttons */}
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous banner"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-80 active:scale-90 shadow-md z-10"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-80 active:scale-90 shadow-md z-10"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

      {/* Indicator Dots */}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5 z-10">
          {banners.map((b, i) => (
            <button
              key={b.id || i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-7 bg-white shadow-xs"
                  : "w-2 bg-white/50 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
