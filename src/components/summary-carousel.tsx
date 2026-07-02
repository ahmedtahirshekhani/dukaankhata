"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCarouselProps {
  cards: React.ReactNode[];
  className?: string;
  itemClassName?: string;
}

export function SummaryCarousel({ cards, className, itemClassName }: SummaryCarouselProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(280);
  const [totalDots, setTotalDots] = useState(cards.length);

  const handleScroll = useCallback(() => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setScrollPosition(scrollLeft);
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 20);
      
      // Calculate dynamic card width based on first child
      if (sliderRef.current.firstElementChild) {
        const cWidth = (sliderRef.current.firstElementChild as HTMLElement).offsetWidth || 280;
        setCardWidth(cWidth);
        
        // Calculate how many dots to show based on visible cards
        const gap = 16;
        const visibleCards = Math.max(1, Math.floor(clientWidth / (cWidth + gap)));
        setTotalDots(Math.max(1, cards.length - visibleCards + 1));
      }
    }
  }, [cards.length]);

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
      
      // Delay one check to ensure layout is computed
      setTimeout(handleScroll, 100);
      
      return () => {
        slider.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
      };
    }
  }, [handleScroll, cards]);

  if (!cards || cards.length === 0) return null;

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
        <style jsx>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        
        {cards.map((card, index) => (
          <div 
            key={index} 
            className={cn("flex-shrink-0 snap-start min-w-0", itemClassName)}
          >
            {card}
          </div>
        ))}
      </div>

      {/* Scroll Indicator Dots */}
      {totalDots > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: totalDots }).map((_, idx) => {
            const gap = 16;
            const totalWidth = cardWidth + gap;
            const currentIndex = Math.max(0, Math.min(totalDots - 1, Math.round(scrollPosition / totalWidth)));
            const isActive = currentIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => {
                  if (sliderRef.current) {
                    sliderRef.current.scrollTo({ left: idx * totalWidth, behavior: "smooth" });
                  }
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  isActive ? "w-6 bg-primary" : "w-2 bg-primary/20 hover:bg-primary/50"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
