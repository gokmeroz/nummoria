// frontend/src/pages/ComingSoon.jsx
export default function ComingSoon({ title = "This page" }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image with 20% opacity */}
      <img
        src="../assets/construction.jpg" // put construction.jpg in /public
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20 -z-10"
      />

      {/* Content */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[#4f772d] mb-3">{title}</h1>
        <p className="text-gray-600 mb-6">
          We’re working on this page. Check back soon!
        </p>
        <div className="text-6xl">🚧</div>
      </div>
    </div>
  );
}
