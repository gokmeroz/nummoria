// frontend/src/pages/ComingSoon.jsx
export default function ComingSoon({ title = "This page" }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50">
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
