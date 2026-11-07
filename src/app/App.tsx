import { RouterProvider } from "react-router-dom";
import { ApplicationStateProvider } from "../state";
import { ToastProvider, ToastContainer } from "../components/feedback";
import { router } from "../routes";
import "../styles/App.css";

export default function App() {
  return (
    <ApplicationStateProvider>
      <ToastProvider>
        <RouterProvider router={router} />
        <ToastContainer />
      </ToastProvider>
    </ApplicationStateProvider>
  );
}
