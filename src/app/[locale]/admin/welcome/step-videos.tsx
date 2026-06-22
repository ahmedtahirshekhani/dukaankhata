"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { PlayCircle } from "lucide-react";

// Helper function to extract YouTube video ID from various URL formats
function extractYoutubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Static array of step videos - just put the full URL here!
const stepVideos = [
  {
    id: "1",
    title: "Software kese Download krein | Desktop",
    url: "https://www.youtube.com/watch?v=GW3I2PNUm50&list=PLt2XPtP0TX29bzn7G_IWOPAgHlL_1JQXh&index=1",
  },
  {
    id: "2",
    title: "Parties/Customers kese Create krein | Desktop",
    url: "https://www.youtube.com/watch?v=qF3sIz91Id0&list=PLt2XPtP0TX29bzn7G_IWOPAgHlL_1JQXh&index=2",
  },
  {
    id: "3",
    title: "Items/Inventories kese Add krein | Desktop",
    url: "https://www.youtube.com/watch?v=JJsdArda6WA&list=PLt2XPtP0TX29bzn7G_IWOPAgHlL_1JQXh&index=3",
  },
  {
    id: "4",
    title: "Quotations kese Create krein | Desktop",
    url: "https://www.youtube.com/watch?v=DRynBONqKLs&list=PLt2XPtP0TX29bzn7G_IWOPAgHlL_1JQXh&index=4",
  },
  {
    id: "5",
    title: "Invoices kese Create krein | Desktop",
    url: "https://www.youtube.com/watch?v=QuV2YyoVvGU&list=PLt2XPtP0TX29bzn7G_IWOPAgHlL_1JQXh&index=5",
  },
  {
    id: "6",
    title: "Payment-In kese Create krein | Desktop",
    url: "https://www.youtube.com/watch?v=qbJqZENlNSI&list=PLt2XPtP0TX29bzn7G_IWOPAgHlL_1JQXh&index=6",
  },
  {
    id: "7",
    title: "Expenses kese Create krein | Desktop",
    url: "https://www.youtube.com/watch?v=QeV0VguuTkI&list=PLt2XPtP0TX29bzn7G_IWOPAgHlL_1JQXh&index=7",
  },
  {
    id: "8",
    title: "Company Setting kese Update krein | Desktop",
    url: "https://www.youtube.com/watch?v=8ckMyJ0EaO0&list=PLt2XPtP0TX29bzn7G_IWOPAgHlL_1JQXh&index=8",
  },
  //  {
  //   id: "9",
  //   title: "Reports kese Access krein | Desktop",
  //   url: "https://www.youtube.com/watch?v=QeV0VguuTkI&list=PLt2XPtP0TX29bzn7G_IWOPAgHlL_1JQXh&index=7",
  // },
  //  {
  //   id: "10",
  //   title: "Reports kese Access krein | Desktop",
  //   url: "https://www.youtube.com/watch?v=QeV0VguuTkI&list=PLt2XPtP0TX29bzn7G_IWOPAgHlL_1JQXh&index=7",
  // },
];

export function StepVideos() {
  const t = useTranslations("welcome"); // You can use translation keys if needed
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const selectedVideo = stepVideos.find((v) => v.id === selectedVideoId);
  const selectedYoutubeId = selectedVideo ? extractYoutubeId(selectedVideo.url) : null;

  return (
    <div className="mt-8 w-full">
      <h2 className="text-xl font-semibold mb-4 text-center">Video Tutorials</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {stepVideos.map((video) => {
          const youtubeId = extractYoutubeId(video.url);
          const thumbnail = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : "";

          return (
            <Card
              key={video.id}
              className="cursor-pointer hover:shadow-lg transition-shadow group overflow-hidden border-2 border-transparent hover:border-primary/20"
              onClick={() => setSelectedVideoId(video.id)}
            >
              <CardContent className="p-0 relative">
                <div className="aspect-video relative overflow-hidden bg-slate-100">
                  {thumbnail ? (
                    <Image
                      src={thumbnail}
                      alt={video.title}
                      fill
                      unoptimized
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <span className="text-gray-500">Invalid Video URL</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <PlayCircle className="w-12 h-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all shadow-sm rounded-full" />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-center line-clamp-2">{video.title}</h3>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedVideoId} onOpenChange={(open) => !open && setSelectedVideoId(null)}>
        <DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden bg-black border-none shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedVideo?.title}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full bg-black relative">
            {selectedYoutubeId ? (
              <iframe
                src={`https://www.youtube.com/embed/${selectedYoutubeId}?autoplay=1`}
                title={selectedVideo?.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute top-0 left-0 w-full h-full border-0"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                Invalid Video URL
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
