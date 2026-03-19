import { useEffect } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Projects from "./pages/project/Projects";

import AllProjects from "./pages/project/AllProjects";
import CreateProject from "./pages/project/projectCreate/CreateProject";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import { useSelector, useDispatch } from "react-redux";
import { clearAuth, finishAuthCheck } from "./store/authSlice";
import { initUserTabs, addTab, updateTab, removeTab } from "./store/tabsSlice";

const PUBLIC_ROUTES = ["/login", "/register"];
// Wizard gets its own full-screen layout — no sidebar/navbar
const FULLSCREEN_ROUTES = ["/projects/create-new"];

const App = () => {
  const userId = useSelector((state) => state.auth.user?._id);
  const openTabs =
    useSelector((state) => state.tabs?.byUser?.[userId]?.openTabs) || [];
  const projectsById = useSelector((state) => state.projects.byId);

  const dispatch = useDispatch();
  const { isAuthenticated, loading } = useSelector((state) => state.auth);

  const navigate = useNavigate();
  const location = useLocation();

  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);
  const isFullscreenRoute = FULLSCREEN_ROUTES.includes(location.pathname);
  const hideChrome = isPublicRoute || isFullscreenRoute;

  // ── Auth init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    dispatch(initUserTabs(userId));
  }, [dispatch, isAuthenticated, userId]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) dispatch(clearAuth());
    dispatch(finishAuthCheck());
  }, [dispatch]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated && !isPublicRoute) {
      navigate("/login", { replace: true });
    } else if (isAuthenticated && isPublicRoute) {
      navigate("/projects", { replace: true });
    }
  }, [loading, isAuthenticated, location.pathname, navigate, isPublicRoute]);

  // ── Clear wizard draft when navigating away from create page ───────────────
  // This lets "All Projects → Create New" always start fresh intentionally,
  // while a browser refresh on the wizard stays on the same draft.
  // We only clear when the user explicitly leaves to a NON-wizard route.
  useEffect(() => {
    const wasOnWizard = sessionStorage.getItem("wizardDraftId");
    if (!wasOnWizard) return;
    // If we've navigated away from the wizard entirely, clear the session draft
    if (!isFullscreenRoute) {
      sessionStorage.removeItem("wizardDraftId");
    }
  }, [location.pathname, isFullscreenRoute]);

  // ── Tab routing config ──────────────────────────────────────────────────────
  const staticMenuConfig = {
    "/projects": { id: "projects", title: "Projects" },
    "/design-ai/create": { id: "design-ai-create", title: "AI Create" },
    "/design-ai/ask": { id: "design-ai-ask", title: "AI Ask" },
    "/inventory": { id: "inventory", title: "Inventory" },
  };

  // ── Tab manager ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const currentPath = location.pathname;
    if (isPublicRoute || isFullscreenRoute) return;

    if (staticMenuConfig[currentPath]) {
      const config = staticMenuConfig[currentPath];
      dispatch(
        addTab({
          userId,
          tab: { id: config.id, title: config.title, path: currentPath },
        }),
      );
      dispatch(
        updateTab({
          userId,
          tab: { id: config.id, title: config.title, path: currentPath },
        }),
      );
      return;
    }

    if (currentPath.startsWith("/design-ai/")) {
      const mode = currentPath.split("/")[2];
      const id = `design-ai-${mode}`;
      const title = mode === "create" ? "AI Create" : "AI Ask";
      dispatch(addTab({ userId, tab: { id, title, path: currentPath } }));
      return;
    }

    const projectMatch = currentPath.match(/\/projects\/([^/]+)/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      const project = projectsById?.[projectId];
      console.log("Matched project route:", projectId, project);
      dispatch(
        addTab({
          userId,
          tab: {
            id: projectId,
            title: project?.name || "Project",
            path: `/projects/${projectId}`,
          },
        }),
      );
    }
  }, [dispatch, location.pathname, projectsById, userId]);

  // ── Tab close handler ───────────────────────────────────────────────────────
  const closeTab = (e, id) => {
    e.stopPropagation();
    if (!userId) return;
    const remaining = openTabs.filter((tab) => tab.id !== id);
    dispatch(removeTab({ userId, tabId: id }));
    if (location.pathname.includes(id)) {
      navigate(
        remaining.length > 0
          ? remaining[remaining.length - 1].path
          : "/projects",
      );
    }
  };
  function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
      const scrollContainer = document.querySelector("main");
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: "auto" });
      }
    }, [pathname]);

    return null;
  }
  // ── Loading guard ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-slate-400">
        Loading workspace...
      </div>
    );
  }

  // ── Fullscreen wizard layout ────────────────────────────────────────────────
  if (isFullscreenRoute) {
    return (
      <Routes>
        <Route path="/projects/create-new" element={<CreateProject />} />
      </Routes>
    );
  }

  // ── Main app layout ─────────────────────────────────────────────────────────
  return (
    <>
      {" "}
      <ScrollToTop />
      <div className="h-screen w-full flex bg-[#FCFCFD] text-slate-900 font-sans antialiased overflow-hidden">
        {!hideChrome && <Sidebar />}

        <div className="flex-1 flex flex-col min-w-0 bg-white relative">
          {!hideChrome && (
            <Navbar
              tabs={openTabs}
              activePath={location.pathname}
              closeTab={closeTab}
            />
          )}

          <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFCFD]">
            <div className="w-full min-h-full">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/" element={<Navigate to="/projects" replace />} />
                <Route path="/projects" element={<AllProjects />} />
                <Route path="/projects/:projectId/*" element={<Projects />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default App;
