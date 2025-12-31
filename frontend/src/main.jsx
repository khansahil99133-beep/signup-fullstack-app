
import React from "react";
import { createRoot } from "react-dom/client";

const api = import.meta.env.VITE_API_BASE;

function App() {
  return (
    <div>
      <h1>User Frontend</h1>
      <p>Backend: {api}</p>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
