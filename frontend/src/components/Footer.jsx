// frontend/src/components/Footer.jsx
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
    case "instagram":
      return `https://instagram.com/${value}`;
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
    Support: [{ label: "Contact Us", href: "/support" }],
  },
  socials = {
    x: "nummoria",
    github: "gokmeroz/nummoria",
    instagram: "nummoria",
  },
  className = "",
  fullBleed = false,
}) {
  const year = new Date().getFullYear();

  const wrapTop = fullBleed
    ? "w-full px-6 lg:px-10 py-12"
    : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12";

  const wrapBottom = fullBleed
    ? "w-full px-6 lg:px-10 py-5"
    : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5";

  const sectionsOrder = ["Product", "Company", "Legal"];

  const xUrl = socialUrl("x", socials.x);
  const ghUrl = socialUrl("github", socials.github);
  const igUrl = socialUrl("instagram", socials.instagram);

  return (
    <footer className={`relative w-full ${className}`}>
      {/* background + top hairline */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#070A07]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_15%_0%,rgba(19,226,67,0.10),transparent_55%),radial-gradient(700px_500px_at_85%_15%,rgba(153,23,70,0.12),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/25 to-black/60" />
      </div>

      <div
        className="w-full"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)",
          height: 1,
        }}
      />

      {/* Top */}
      <div className={wrapTop}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-2 rounded-2xl blur-2xl opacity-25 bg-white/10" />
                <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-2">
                  <img
                    src={logo}
                    alt="Nummoria Logo"
                    className="h-8 w-8 rounded-xl object-contain"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-xl font-semibold tracking-tight text-white">
                    {brand.name}
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: main }}
                    />
                    PRIVATE BY DEFAULT
                  </span>
                </div>
                <div className="mt-1 text-sm text-white/65">
                  {brand.tagline}
                </div>
              </div>
            </div>

            <div className="mt-6 max-w-md text-sm text-white/60 leading-relaxed">
              Clean money tracking, decision-ready reporting, and AI-assisted
              clarity—built to keep you consistent without noise.
            </div>
          </div>

          {/* Nav columns */}
          {sectionsOrder.map((section) => {
            const items = nav[section] || [];
            return (
              <div key={section} className="md:col-span-1">
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-white/60">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: main }}
                  />
                  {section}
                </div>

                <ul className="mt-4 space-y-2.5 text-sm">
                  {items.map((it, idx) => (
                    <li key={idx}>
                      <a
                        href={it.href}
                        className="group inline-flex items-center gap-2 text-white/70 hover:text-white transition"
                      >
                        <span className="h-1 w-1 rounded-full bg-white/30 group-hover:bg-white/60 transition" />
                        <span className="border-b border-transparent group-hover:border-white/30 transition">
                          {it.label}
                        </span>
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
      <div className="border-t border-white/10">
        <div
          className={
            wrapBottom +
            " flex flex-col md:flex-row items-center justify-between gap-4"
          }
        >
          <div className="text-xs text-white/55">
            © {year} {brand.name}. All rights reserved.
          </div>

          <div className="flex items-center gap-2">
            {xUrl && (
              <SocialIconButton
                href={xUrl}
                label="X (Twitter)"
                title="X"
                main={main}
              >
                {/* minimalist X glyph */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </SocialIconButton>
            )}

            {ghUrl && (
              <SocialIconButton
                href={ghUrl}
                label="GitHub"
                title="GitHub"
                main={main}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2C7.03 2 3 6.03 3 11c0 3.98 2.58 7.35 6.16 8.54.45.08.62-.2.62-.44 0-.22-.01-.94-.01-1.71-2.25.49-2.73-.55-2.9-1.06-.1-.25-.54-1.06-.92-1.27-.31-.17-.76-.6-.01-.61.71-.01 1.22.65 1.39.92.81 1.37 2.1.98 2.62.75.08-.59.31-.98.56-1.21-2-.23-4.1-1-4.1-4.46 0-.98.35-1.79.92-2.42-.09-.23-.4-1.17.09-2.43 0 0 .75-.24 2.46.93a8.44 8.44 0 0 1 4.48 0c1.7-1.17 2.45-.93 2.45-.93.49 1.26.18 2.2.09 2.43.57.63.92 1.44.92 2.42 0 3.47-2.1 4.23-4.11 4.45.32.28.6.83.6 1.68 0 1.21-.01 2.19-.01 2.49 0 .24.17.53.63.44A9.006 9.006 0 0 0 21 11c0-4.97-4.03-9-9-9Z"
                    fill="currentColor"
                  />
                </svg>
              </SocialIconButton>
            )}

            {igUrl && (
              <SocialIconButton
                href={igUrl}
                label="Instagram"
                title="Instagram"
                main={main}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="2"
                    y="2"
                    width="20"
                    height="20"
                    rx="5"
                    ry="5"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle cx="17" cy="7" r="1" fill="currentColor" />
                </svg>
              </SocialIconButton>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIconButton({ href, label, title, children, main }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={title}
      className="group relative inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-white/10 bg-white/[0.04] text-white/65 backdrop-blur-md transition
                 hover:text-white hover:border-white/20 hover:-translate-y-0.5"
    >
      <span
        className="pointer-events-none absolute -inset-2 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `color-mix(in srgb, ${main} 22%, transparent)` }}
      />
      <span className="relative">{children}</span>
    </a>
  );
}
