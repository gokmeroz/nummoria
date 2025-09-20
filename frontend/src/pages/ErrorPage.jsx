// src/pages/ErrorPage.jsx
import { Link } from "react-router-dom";
const main = "#4f772d";
// const secondary = "#90a955";

export default function ErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-center p-6">
      {/* Facebook-like header */}
      <div className="flex items-center gap-2 mb-6">
        {/* <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: main }}
        >
          <span
            className="text-white text-lg font-bold"
            style={{ color: secondary }}
          >
            N
          </span>
        </div> */}
        <img
          src="../src/assets/numora_logo.png"
          alt="Nummora Logo"
          className="h-8 w-8"
        />
        <span className="text-xl font-semibold " style={{ color: main }}>
          Nummora
        </span>
      </div>

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

      <footer className="text-xs text-gray-400">
        Nummora © {new Date().getFullYear()} ·{" "}
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
      </footer>
    </div>
  );
}
