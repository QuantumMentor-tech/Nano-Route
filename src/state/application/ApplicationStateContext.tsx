import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type {
  ApplicationState,
  ApplicationContextValue,
} from "./applicationTypes";
import {
  applicationReducer,
  initialApplicationState,
} from "./applicationReducer";
import { checkNativeHealth } from "../../services/ipc";

const ApplicationStateContext = createContext<ApplicationContextValue | null>(
  null
);

export interface ApplicationStateProviderProps {
  children: React.ReactNode;
  initialState?: Partial<ApplicationState>;
}

export const ApplicationStateProvider: React.FC<ApplicationStateProviderProps> = ({
  children,
  initialState,
}) => {
  const [state, dispatch] = useReducer(
    applicationReducer,
    initialState
      ? { ...initialApplicationState, ...initialState }
      : initialApplicationState
  );

  const runHealthCheck = useCallback(async () => {
    dispatch({ type: "INITIALIZATION_STARTED" });

    try {
      const response = await checkNativeHealth();

      if (response.isNative) {
        dispatch({
          type: "INITIALIZATION_SUCCEEDED",
          payload: {
            isNative: true,
            message: response.status,
          },
        });
      } else {
        // In browser dev mode, the shell is operational in web preview
        dispatch({
          type: "INITIALIZATION_SUCCEEDED",
          payload: {
            isNative: false,
            message: response.status,
          },
        });
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unexpected native initialization error";
      dispatch({
        type: "INITIALIZATION_DEGRADED",
        payload: {
          message: "Native core initialization degraded",
          error: errorMessage,
        },
      });
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  const value = useMemo<ApplicationContextValue>(
    () => ({
      state,
      refreshHealth: runHealthCheck,
    }),
    [state, runHealthCheck]
  );

  return (
    <ApplicationStateContext.Provider value={value}>
      {children}
    </ApplicationStateContext.Provider>
  );
};

ApplicationStateProvider.displayName = "ApplicationStateProvider";

export function useApplicationState(): ApplicationContextValue {
  const context = useContext(ApplicationStateContext);
  if (!context) {
    throw new Error(
      "useApplicationState must be used within an ApplicationStateProvider"
    );
  }
  return context;
}

