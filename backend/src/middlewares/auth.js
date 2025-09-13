import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || ""; // Get the Authorization header from the request, default to empty string if missing
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null; // Extract the token if the header starts with 'Bearer ', else set to null
  if (!token) return res.status(401).json({ error: "Missing token" }); // If no token is found, respond with 401 Unauthorized

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET); // Verify the token using the secret key, get the payload if valid
    req.userId = payload.id; // Attach the user ID from the payload to the request object
    next(); // Call the next middleware or route handler
  } catch {
    res.status(401).json({ error: "Invalid/expired token" }); // If verification fails, respond with 401 Unauthorized
  }
}
