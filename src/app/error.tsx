"use client";

import { useEffect } from "react";
import Link from "next/link";

// Global error boundary page for the App Router
// Displays owner contact information and a simple retry option
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to your monitoring service here if desired
    // console.error(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-white text-gray-900">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-lg border border-gray-200 shadow-sm p-6">
            <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">
              An unexpected error occurred. If this keeps happening, please contact
              the owner for help.
            </p>

            <div className="space-y-2 mb-6">
              <div>
                <span className="font-medium">WhatsApp (Germany): </span>
                <a
                  href="https://wa.me/491785141157"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  +49 178 5141157 (Ahmed Tahir Shekhani)
                </a>
              </div>
              <div>
                <span className="font-medium">LinkedIn: </span>
                <a
                  href="https://www.linkedin.com/in/ahmedtahirshekhani/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  linkedin.com/in/ahmedtahirshekhani/
                </a>
              </div>
              <div>
                <span className="font-medium">Email: </span>
                <a
                  href="mailto:ahmedtahir.developer@gmail.com"
                  className="text-blue-600 hover:underline"
                >
                  ahmedtahir.developer@gmail.com
                </a>
              </div>
              <div>
                <span className="font-medium">Phone (Pakistan): </span>
                <a href="tel:+923352575725" className="text-blue-600 hover:underline">
                  +92 335 2575725 (M. Kashan Shekhani)
                </a>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => reset()}
                className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Go home
              </Link>
            </div>

            {error?.digest && (
              <p className="mt-6 text-xs text-gray-500">Error ID: {error.digest}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
