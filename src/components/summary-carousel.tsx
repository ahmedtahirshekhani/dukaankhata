"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCarouselProps {
  cards: React.ReactNode[];
  className?: string;
  itemClassName?: string;
  isLoading?: boolean;
}

export function SummaryCarousel({ cards, className, itemClassName, isLoading }: SummaryCarouselProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(280);
  const [totalDots, setTotalDots] = useState(cards?.length || 0);

  const handleScroll = useCallback(() => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setScrollPosition(scrollLeft);
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 20);
      
      if (sliderRef.current.firstElementChild) {
        const cWidth = (sliderRef.current.firstElementChild as HTMLElement).offsetWidth || 280;
        setCardWidth(cWidth);
        
        const gap = 16;
        const visibleCards = Math.max(1, Math.floor(clientWidth / (cWidth + gap)));
        setTotalDots(Math.max(1, (cards?.length || 0) - visibleCards + 1));
      }
    }
  }, [cards?.length]);

  const scrollLeftBtn = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -cardWidth, behavior: "smooth" });
    }
  };

  const scrollRightBtn = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: cardWidth, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const slider = sliderRef.current;
    if (slider) {
      slider.addEventListener("scroll", handleScroll);
      handleScroll();
      window.addEventListener("resize", handleScroll);
      
      setTimeout(handleScroll, 100);
      
      return () => {
        slider.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
      };
    }
  }, [handleScroll, cards]);

  // If loading or cards array is empty, render persistent skeleton cards to prevent layout collapse
  if (isLoading || !cards || cards.length === 0) {
    return (
      <div className={cn("relative w-full min-w-0 max-w-full", className)}>
        <div className="flex overflow-x-hidden gap-4 pb-4 w-full">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn("basis-[45%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5 shrink-0", itemClassName)}
            >
              <div className="flex flex-col p-3 gap-2 border rounded-xl bg-card shadow-sm h-[88px] justify-between">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-6 w-6 rounded-md" />
                </div>
                <Skeleton className="h-5 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full min-w-0 max-w-full", className)}>
      {/* Left Arrow */}
      {showLeftArrow && (
        <button
          onClick={scrollLeftBtn}
          className="absolute left-1 sm:-left-5 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full shadow-md p-1.5 border border-gray-200 hover:bg-gray-50 transition-all"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
      )}

      {/* Right Arrow */}
      {showRightArrow && (
        <button
          onClick={scrollRightBtn}
          className="absolute right-1 sm:-right-5 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full shadow-md p-1.5 border border-gray-200 hover:bg-gray-50 transition-all"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      )}

      {/* Slider Container */}
      <div
        ref={sliderRef}
        className="flex overflow-x-auto scroll-smooth gap-4 pb-4 hide-scrollbar snap-x snap-mandatory w-full max-w-full"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {cards.map((card, idx) => (
          <div
            key={idx}
            className={cn("shrink-0 snap-start", itemClassName)}
          >
            {card}
          </div>
        ))}
      </div>
    </div>
  );
}
