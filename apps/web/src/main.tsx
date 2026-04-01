import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "./hooks/useTranslation";
import { ThemeProvider } from "./hooks/useTheme";
import App from "./App";
import "./theme.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
