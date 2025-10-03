// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import App from "./App.jsx";
import OAuthCallback from "./pages/OAuthCallback.jsx"; // <-- add this page
import "./index.css";

const router = createBrowserRouter([
  // Dedicated callback route for social logins
  { path: "/oauth-callback", element: <OAuthCallback /> },

  // Everything else stays under your existing App
  { path: "*", element: <App /> },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
