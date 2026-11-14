import { RouterProvider } from "react-router-dom";
import { ApplicationStateProvider } from "../state";
import { ToastProvider, ToastContainer } from "../components/feedback";
import { PreferencesProvider } from "../features/settings";
import { ProfilesProvider } from "../features/profiles";
import { SessionProvider } from "../features/session";
import {
  NotificationProvider,
  UnifiedToastContainer,
  NotificationCenterDrawer,
  SystemStatusBanner,
} from "../features/notifications";
import {
  CommandPaletteProvider,
  CommandPaletteModal,
} from "../features/commands";
import { router } from "../routes";
import "../styles/App.css";

export default function App() {
  return (
    <ApplicationStateProvider>
      <PreferencesProvider>
        <NotificationProvider>
          <ProfilesProvider>
            <SessionProvider>
              <ToastProvider>
                <RouterProvider router={router} />
                <CommandPaletteProvider>
                  <SystemStatusBanner />
                  <ToastContainer />
                  <UnifiedToastContainer />
                  <NotificationCenterDrawer />
                  <CommandPaletteModal />
                </CommandPaletteProvider>
              </ToastProvider>
            </SessionProvider>
          </ProfilesProvider>
        </NotificationProvider>
      </PreferencesProvider>
    </ApplicationStateProvider>
  );
}
