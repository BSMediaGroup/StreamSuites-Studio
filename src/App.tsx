import { RouterProvider } from "react-router-dom";
import { studioRouter } from "./app/router";
import { StudioAuthProvider } from "./auth/StudioAuthProvider";
import { ThemeProvider } from "./theme/ThemeProvider";

export function App() {
  return (
    <ThemeProvider>
      <StudioAuthProvider>
        <RouterProvider router={studioRouter} future={{ v7_startTransition: true }} />
      </StudioAuthProvider>
    </ThemeProvider>
  );
}
