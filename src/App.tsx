import { RouterProvider } from "react-router-dom";
import { studioRouter } from "./app/router";
import { GlobalActivityProvider } from "./activity/GlobalActivityProvider";
import { StudioAuthProvider } from "./auth/StudioAuthProvider";
import { ThemeProvider } from "./theme/ThemeProvider";
import { PresentationProvider } from "./presentation/PresentationProvider";

export function App() {
  return (
    <ThemeProvider>
      <GlobalActivityProvider>
        <PresentationProvider>
          <StudioAuthProvider>
            <RouterProvider router={studioRouter} future={{ v7_startTransition: true }} />
          </StudioAuthProvider>
        </PresentationProvider>
      </GlobalActivityProvider>
    </ThemeProvider>
  );
}
