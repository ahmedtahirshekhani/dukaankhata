"use client";

import { useEffect } from "react";
import Link from "next/link";

// Locale-aware error boundary page for routes under /[locale]
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-lg border border-gray-200 shadow-sm p-6">
        <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-600 mb-4">
          An unexpected error occurred. If this keeps happening, please contact the owner.
        </p>

        <div className="space-y-2 mb-6">
          <div>
            <span className="font-medium">WhatsApp (Germany): </span>
            <a
              href="https://wa.me/491786141157"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              +49 178 6141157 (Ahmed Tahir Shekhani) - Germany
              +92 3352575725 (M. Kashan Shekhani) - Pakistan
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
              +92 3352575725 (M. Kashan Shekhani)
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
  );
}
