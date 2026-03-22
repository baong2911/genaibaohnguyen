import { useState, useEffect, useContext, createContext } from "react";
import Index from "@/pages/Index";
import Log from "@/pages/Log";
import SummarizeNote from "@/pages/SummarizeNote";
import MindMapPage from "@/pages/MindMap";
import FlashCardPage from "@/pages/FlashCard";
import NotFound from "@/pages/NotFound";

export type Route = "home" | "log" | "summarize" | "mindmap" | "flashcard" | "404";

interface RouterContextValue {
  currentRoute: Route;
  navigateTo: (route: Route, replace?: boolean) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

const getRouteFromPath = (path: string): Route => {
  if (path === "/log") return "log";
  if (path === "/summarize") return "summarize";
  if (path === "/mindmap") return "mindmap";
  if (path === "/flashcard") return "flashcard";
  if (path === "/") return "home";
  return "404";
};

const getPathFromRoute = (route: Route): string => {
  if (route === "log") return "/log";
  if (route === "summarize") return "/summarize";
  if (route === "mindmap") return "/mindmap";
  if (route === "flashcard") return "/flashcard";
  if (route === "404") return "/404";
  return "/";
};

export const useRouter = (): RouterContextValue => {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside <Router>");
  return ctx;
};

const Router = () => {
  const [currentRoute, setCurrentRoute] = useState<Route>(() =>
    getRouteFromPath(window.location.pathname)
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getRouteFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (route: Route, replace: boolean = false) => {
    const path = getPathFromRoute(route);
    if (replace) {
      window.history.replaceState(null, "", path);
    } else {
      window.history.pushState(null, "", path);
    }
    setCurrentRoute(route);
  };

  const renderPage = () => {
    switch (currentRoute) {
      case "home":      return <Index />;
      case "log":       return <Log />;
      case "summarize": return <SummarizeNote />;
      case "mindmap":   return <MindMapPage />;
      case "flashcard": return <FlashCardPage />;
      case "404":
      default:          return <NotFound />;
    }
  };

  return (
    <RouterContext.Provider value={{ currentRoute, navigateTo }}>
      {renderPage()}
    </RouterContext.Provider>
  );
};

export default Router;
