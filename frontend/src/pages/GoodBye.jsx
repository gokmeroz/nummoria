/* eslint-disable no-empty */
/* src/pages/Goodbye.jsx */
import { useEffect } from "react";
// Option A: import the asset (keeps it fingerprinted on build)

export default function Goodbye() {
  useEffect(() => {
    // clear auth artifacts
    try {
      localStorage.removeItem("token");
    } catch {}
  }, []);

  return (
    <div className="relative min-h-dvh flex items-center justify-center px-6">
      {/* Background image */}
      <img
        src="../../src/assets/bye.jpg"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover -z-10"
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/20 -z-10" />

      <div className="w-full max-w-lg">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow border overflow-hidden">
          {/* Header band */}
          <div
            className="h-24 w-full"
            style={{
              background: "linear-gradient(120deg, #4f772d 0%, #90a955 100%)",
            }}
          />

          {/* Content */}
          <div className="-mt-10 px-6 pb-6 text-center">
            <div className="mx-auto w-20 h-20 rounded-full ring-4 ring-white bg-gray-100 grid place-items-center shadow">
              {/* icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-10 h-10 text-gray-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M15 12h6" />
                <path d="M15 8h6" />
                <path d="M15 16h6" />
                <path d="M8 21a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" />
                <path d="M8 11v6" />
              </svg>
            </div>

            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Your account is now deactivated
            </h1>
            <p className="mt-2 text-gray-600">
              We’ve processed your request to delete (soft-delete) your account.
              If you change your mind, you can restore it by contacting support.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/login"
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg text-white font-semibold"
                style={{ backgroundColor: "#4f772d" }}
              >
                Back to Login
              </a>
              <a
                href="mailto:support@nummoria.app?subject=Restore%20my%20account"
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg border font-semibold text-gray-700 hover:bg-gray-50"
              >
                Contact Support
              </a>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              Need to restore your account? We keep deleted accounts for a
              limited time. Reach out with the email you signed up with.
            </div>
          </div>
        </div>

        {/* Extra links */}
        <div className="text-center mt-4 text-sm text-gray-200">
          <a href="/" className="underline">
            Go to homepage
          </a>
        </div>
      </div>
    </div>
  );
}
