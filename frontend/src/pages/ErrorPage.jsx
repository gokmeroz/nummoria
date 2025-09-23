// src/pages/ErrorPage.jsx
import { Link } from "react-router-dom";

const main = "#4f772d";
const secondary = "#90a955";

export default function ErrorPage() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen text-center p-6 overflow-hidden">
      {/* Background image */}
      <img
        src="../src/assets/construction.jpg" // adjust if using /public → "/construction.jpg"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover opacity-20 -z-10"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <img
          src="../src/assets/nummora_logo.png"
          alt="Nummora Logo"
          className="h-8 w-8"
        />
        <span className="text-xl font-semibold" style={{ color: main }}>
          Nummora
        </span>
      </div>

      {/* Content */}
      <h1 className="text-2xl font-bold mb-2">Sorry, something went wrong.</h1>
      <p className="text-gray-600 mb-6">
        We&apos;re working on getting this fixed as soon as we can.
      </p>

      <Link
        to="/"
        style={{ color: main }}
        className="hover:underline font-medium mb-8"
      >
        Go Back
      </Link>

      {/* Footer */}
      <footer className="text-xs text-gray-400">
        Nummora © {new Date().getFullYear()} ·{" "}
        <div style={{ color: secondary }}>
          <a href="#" className="hover:underline">
            Help
          </a>
          {" · "}
          <a href="#" className="hover:underline">
            Terms
          </a>
          {" · "}
          <a href="#" className="hover:underline">
            Privacy
          </a>
        </div>
      </footer>
    </div>
  );
}
