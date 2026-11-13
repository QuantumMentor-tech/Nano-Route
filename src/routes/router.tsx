import { createHashRouter } from "react-router-dom";
import { RootLayout } from "../layouts";
import {
  DashboardPage,
  ChatPage,
  HistoryPage,
  SettingsPage,
  LicensePage,
  AboutPage,
  ContactPage,
  NotFoundPage,
  DiagnosticsPage,
} from "../pages";

export const router = createHashRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "chat",
        element: <ChatPage />,
      },
      {
        path: "history",
        element: <HistoryPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
      {
        path: "license",
        element: <LicensePage />,
      },
      {
        path: "about",
        element: <AboutPage />,
      },
      {
        path: "contact",
        element: <ContactPage />,
      },
      {
        path: "diagnostics",
        element: <DiagnosticsPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

