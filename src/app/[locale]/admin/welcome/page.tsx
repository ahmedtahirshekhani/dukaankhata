"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function WelcomePage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome to Dukaan Khata</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground text-lg mt-2">
            You have successfully logged in.<br />
            Use the sidebar to explore your dashboard features.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
