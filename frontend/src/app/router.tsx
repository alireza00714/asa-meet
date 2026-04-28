import { createBrowserRouter } from "react-router-dom";
import { HomePage } from "./routes/HomePage";
import { MeetingPage } from "./routes/MeetingPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/meeting/:roomId",
    element: <MeetingPage />,
  },
]);
