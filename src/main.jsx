import React from "react";
import { createRoot } from "react-dom/client";
import Mantle from "./Mantle.jsx";

/* The game was written as a Claude artifact, where the page is handed a
   `window.storage` key/value store. Outside that runtime it saves nothing and
   says so, so stand in a localStorage-backed equivalent with the same shape. */
if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      if (value === null) throw new Error("not found: " + key);
      return { key, value };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value };
    },
    async delete(key) {
      localStorage.removeItem(key);
    },
  };
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Mantle />
  </React.StrictMode>
);
