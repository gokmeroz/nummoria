import React from "react";
import logo from "../assets/nummoria_logo.png";

// helper: build full URL from a handle or accept a full URL as-is
function socialUrl(platform, value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value; // already a URL
  switch (platform) {
    case "x":
      return `https://x.com/${value}`;
    case "github":
      return `https://github.com/${value}`;
    case "linkedin":
      return value.includes("/")
        ? `https://www.linkedin.com/${value.replace(/^\/+/, "")}`
        : `https://www.linkedin.com/in/${value}`;
    default:
      return null;
  }
}

export default function Footer({
  brand = { name: "Nummoria", tagline: "A clearer way to see your money." },
  main = "#4f772d",
  nav = {
    Product: [
      { label: "Expenses", href: "/expenses" },
      { label: "Reports", href: "/reports" },
      { label: "Investments", href: "/investments" },
    ],
    Company: [
      { label: "About", href: "/about-us" },
      { label: "Contact", href: "/contact" },
    ],
    Legal: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
  socials = {
    x: "gokmeroz_dev",
    github: "gokmeroz",
    linkedin: "goktugmertozdogan",
  },
  className = "",
  fullBleed = false,
}) {
  const year = new Date().getFullYear();

  const wrapTop = fullBleed
    ? "w-full px-6 lg:px-10 py-10"
    : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10";

  const wrapBottom = fullBleed
    ? "w-full px-6 lg:px-10 py-4"
    : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4";

  const sectionsOrder = ["Product", "Company", "Legal"];

  const xUrl = socialUrl("x", socials.x);
  const ghUrl = socialUrl("github", socials.github);
  const liUrl = socialUrl("linkedin", socials.linkedin);

  return (
    <footer
      className={`w-full border-t border-gray-200 bg-gray-50 ${className}`}
    >
      {/* Top */}
      <div className={wrapTop}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Nummoria Logo"
                className="h-8 w-8 rounded-full object-contain"
              />
              <div>
                <div className="text-xl font-semibold" style={{ color: main }}>
                  {brand.name}
                </div>
                <div className="text-sm text-gray-600">{brand.tagline}</div>
              </div>
            </div>
          </div>

          {/* Nav columns */}
          {sectionsOrder.map((section) => {
            const items = nav[section] || [];
            return (
              <div key={section} className="md:col-span-1">
                <div
                  className="text-sm font-semibold mb-3"
                  style={{ color: main }}
                >
                  {section}
                </div>
                <ul className="space-y-2 text-sm">
                  {items.map((it, idx) => (
                    <li key={idx}>
                      <a
                        href={it.href}
                        className="text-gray-700 hover:underline hover:text-gray-900"
                      >
                        {it.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-200 bg-gray-50">
        <div
          className={
            wrapBottom +
            " flex flex-col md:flex-row items-center justify-between gap-3"
          }
        >
          <div className="text-xs text-gray-500">
            © {year} {brand.name}. All rights reserved.
          </div>

          <div className="flex items-center gap-2">
            {xUrl && (
              <a
                href={xUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full ring-1 ring-gray-200 text-gray-400 hover:text-gray-700 hover:ring-gray-300 transition"
                title="X"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </a>
            )}
            {ghUrl && (
              <a
                href={ghUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full ring-1 ring-gray-200 text-gray-400 hover:text-gray-700 hover:ring-gray-300 transition"
                title="GitHub"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2C7.03 2 3 6.03 3 11c0 3.98 2.58 7.35 6.16 8.54.45.08.62-.2.62-.44 0-.22-.01-.94-.01-1.71-2.25.49-2.73-.55-2.9-1.06-.1-.25-.54-1.06-.92-1.27-.31-.17-.76-.6-.01-.61.71-.01 1.22.65 1.39.92.81 1.37 2.1.98 2.62.75.08-.59.31-.98.56-1.21-2-.23-4.1-1-4.1-4.46 0-.98.35-1.79.92-2.42-.09-.23-.4-1.17.09-2.43 0 0 .75-.24 2.46.93a8.44 8.44 0 0 1 4.48 0c1.7-1.17 2.45-.93 2.45-.93.49 1.26.18 2.2.09 2.43.57.63.92 1.44.92 2.42 0 3.47-2.1 4.23-4.11 4.45.32.28.6.83.6 1.68 0 1.21-.01 2.19-.01 2.49 0 .24.17.53.63.44A9.006 9.006 0 0 0 21 11c0-4.97-4.03-9-9-9Z"
                    fill="currentColor"
                  />
                </svg>
              </a>
            )}
            {liUrl && (
              <a
                href={liUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full ring-1 ring-gray-200 text-gray-400 hover:text-gray-700 hover:ring-gray-300 transition"
                title="LinkedIn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6.94 7.5A1.94 1.94 0 1 1 6.94 3.6a1.94 1.94 0 0 1 0 3.88ZM4.99 9.06h3.9V20H4.98V9.06Zm6.1 0h3.74v1.5h.05c.52-.98 1.8-2.02 3.7-2.02 3.96 0 4.69 2.6 4.69 5.98V20h-3.9v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.85V20h-3.9V9.06Z"
                    fill="currentColor"
                  />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
