import { createBrowserRouter } from "react-router-dom";
import { JoinPage } from "../pages/JoinPage";
import { LandingPage } from "../pages/LandingPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { StudioPage } from "../pages/StudioPage";

export const studioRouter = createBrowserRouter(
  [
    { path: "/", element: <LandingPage /> },
    { path: "/login", element: <LoginPage /> },
    { path: "/studio", element: <StudioPage /> },
    { path: "/join/:inviteCode", element: <JoinPage /> },
    { path: "*", element: <NotFoundPage /> },
  ],
  {
    future: {
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_relativeSplatPath: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);
