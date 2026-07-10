import { RouterProvider } from "react-router-dom";
import { studioRouter } from "./app/router";

export function App() {
  return <RouterProvider router={studioRouter} future={{ v7_startTransition: true }} />;
}
