"use client";

import { ArrowRight, CheckCircle2, Zap, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface LandingHeroProps {
  onJoinClick: () => void;
}

export function LandingHero({ onJoinClick }: LandingHeroProps) {
  const features = [
    {
      icon: Zap,
      title: "Lightning Fast",
      description:
        "Quick and easy sales processing with our intuitive POS system",
    },
    {
      icon: Users,
      title: "Customer Management",
      description:
        "Keep track of all your customers and their purchase history",
    },
    {
      icon: TrendingUp,
      title: "Smart Analytics",
      description:
        "Get insights into your business performance with detailed reports",
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="w-full py-12 md:py-20 lg:py-28 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
            {/* Left Column */}
            <div className="flex flex-col justify-center space-y-6">
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
                  Your Business Management
                  <span className="text-primary"> Made Simple</span>
                </h1>
                <p className="text-lg text-muted-foreground md:text-xl">
                  DukaanKhata is a complete POS and inventory management
                  solution designed for small businesses in South Asia. Manage
                  sales, inventory, and customers all in one place.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={onJoinClick} className="gap-2">
                  Join the Waitlist
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline">
                  Learn More
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="flex gap-8 pt-4">
                <div>
                  <div className="text-2xl font-bold">500+</div>
                  <p className="text-sm text-muted-foreground">
                    Waitlist Members
                  </p>
                </div>
                <div>
                  <div className="text-2xl font-bold">99.9%</div>
                  <p className="text-sm text-muted-foreground">
                    Uptime Guarantee
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - Hero Image */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-md h-96 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-muted-foreground">Dashboard Preview</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="w-full py-12 md:py-20 border-t border-border"
      >
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              Powerful Features
            </h2>
            <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
              Everything you need to run your business efficiently
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="w-full py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              Why Choose DukaanKhata?
            </h2>
            <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
              Trusted by businesses across South Asia
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
            {[
              "Easy-to-use interface designed for everyone",
              "Support for multiple languages (English, Urdu, Russian)",
              "Real-time inventory tracking and updates",
              "Detailed financial reports and analytics",
              "Secure cloud-based data storage",
              "24/7 Customer support",
            ].map((benefit, index) => (
              <div key={index} className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                <p className="text-foreground">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-12 md:py-20 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center gap-6 text-center">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
              Ready to Transform Your Business?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Join hundreds of businesses already using DukaanKhata to
              streamline their operations and boost their growth.
            </p>
            <Button size="lg" onClick={onJoinClick} className="gap-2">
              Join the Waitlist Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
