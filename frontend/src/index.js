import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { Toaster } from "sonner";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
      <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'Figtree' } }} />
    </AppErrorBoundary>
  </React.StrictMode>,
);
