"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight, Home, Zap } from "lucide-react";
import { LanguageSwitcher } from "@/components/language/language-switcher";
import { Button } from "@/components/ui/button";

const confetti = () => {
  if (typeof window === "undefined") return;

  const particles = 50;
  const particleSize = 10;
  const animationDuration = 3000;

  for (let i = 0; i < particles; i++) {
    const particle = document.createElement("div");
    particle.style.position = "fixed";
    particle.style.left = Math.random() * 100 + "%";
    particle.style.top = "-10px";
    particle.style.width = particleSize + "px";
    particle.style.height = particleSize + "px";
    particle.style.backgroundColor = [
      "#3b82f6",
      "#06b6d4",
      "#10b981",
      "#f59e0b",
      "#ef4444",
    ][Math.floor(Math.random() * 5)];
    particle.style.borderRadius = "50%";
    particle.style.pointerEvents = "none";
    particle.style.zIndex = "9999";

    document.body.appendChild(particle);

    const duration = 2000 + Math.random() * 1000;
    const xMove = (Math.random() - 0.5) * 300;
    const rotation = Math.random() * 720;

    particle.animate(
      [
        { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
        {
          transform: `translate(${xMove}px, ${window.innerHeight + 100}px) rotate(${rotation}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: duration,
        easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }
    );

    setTimeout(() => particle.remove(), duration);
  }
};

export default function WelcomePage({ params }: { params: { locale: string } }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    confetti();
  }, []);

  const handleLogin = () => {
    router.push(`/${params.locale}/login`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 flex flex-col relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Mobile Navbar */}
      <div className="md:hidden sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="font-bold text-sm">Dukaan Khata</h1>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Desktop Buttons */}
      <div className="hidden md:block absolute top-4 left-4 z-10">
        <Link href={`/${params.locale}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Home className="h-4 w-4" />
            {t("home")}
          </Button>
        </Link>
      </div>
      <div className="hidden md:block absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="max-w-2xl w-full space-y-8">
          {/* Icon and Title */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg">
              <Zap className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {t("welcomeTitle")}
            </h1>

            {/* Funny Messages */}
            <div className="space-y-3 mt-6">
              <p className="text-xl text-gray-700 font-semibold">
                {t("welcomeHeading")}
              </p>
              <p className="text-lg text-gray-600">
                {t("welcomeMessage1")}
              </p>
              <p className="text-lg text-gray-600">
                {t("welcomeMessage2")}
              </p>
              <p className="text-lg text-purple-600 font-medium">
                {t("welcomeMessage3")}
              </p>
            </div>
          </div>

          {/* Call-to-Action Cards */}
          <div className="grid md:grid-cols-2 gap-4 mt-8">
            <div className="p-6 bg-white/80 backdrop-blur rounded-xl border border-blue-200 shadow-lg hover:shadow-xl transition">
              <h3 className="font-bold text-lg text-blue-600 mb-2">
                {t("welcomeCardDashboard")}
              </h3>
              <p className="text-gray-600 text-sm">
                {t("welcomeCardDashboardDesc")}
              </p>
            </div>

            <div className="p-6 bg-white/80 backdrop-blur rounded-xl border border-purple-200 shadow-lg hover:shadow-xl transition">
              <h3 className="font-bold text-lg text-purple-600 mb-2">
                {t("welcomeCardSales")}
              </h3>
              <p className="text-gray-600 text-sm">
                {t("welcomeCardSalesDesc")}
              </p>
            </div>
          </div>

          {/* Funny Footer Message */}
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-600 mb-2">
              {t("welcomeProTip")}
            </p>
          </div>

          {/* Get Started Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleLogin}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white gap-2 px-8 shadow-lg hover:shadow-xl transition"
            >
              {t("welcomeButtonText")}
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Small disclaimer */}
          <p className="text-center text-sm text-gray-500">
            {t("welcomeFooter")}
          </p>
        </div>
      </div>

      {/* Add animation styles */}
      <style jsx>{`
        @keyframes blob {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        @keyframes animation-delay-2000 {
          0% {
            animation-delay: 2s;
          }
        }

        @keyframes animation-delay-4000 {
          0% {
            animation-delay: 4s;
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
