import { createBrowserRouter, RouterProvider } from "react-router";

import { RootLayout } from "@/routes/root-layout";
import { DownloadsPage } from "@/routes/downloads-page";
import { LibraryPage } from "@/routes/library-page";
import { OverviewPage } from "@/routes/overview-page";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "library", element: <LibraryPage /> },
      { path: "downloads", element: <DownloadsPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
