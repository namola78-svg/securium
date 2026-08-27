"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type PresentationIdentity = {
  authenticated: boolean;
  displayName: string | null;
  roles: string[];
};

type PresentationIdentityState = {
  status: "loading" | "authenticated" | "unauthenticated";
  identity: PresentationIdentity | null;
  markUnauthenticated: () => void;
};

const PresentationIdentityContext = createContext<
  PresentationIdentityState | undefined
>(undefined);

let initialSessionRequest: Promise<PresentationIdentity> | null = null;

function requestPresentationIdentity() {
  if (!initialSessionRequest) {
    initialSessionRequest = fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("PRESENTATION_SESSION_FAILED");
        const payload = (await response.json()) as Partial<PresentationIdentity>;
        const authenticated = payload.authenticated === true;
        return {
          authenticated,
          displayName:
            authenticated && typeof payload.displayName === "string"
              ? payload.displayName
              : null,
          roles:
            authenticated && Array.isArray(payload.roles)
              ? payload.roles.filter(
                  (role): role is string => typeof role === "string",
                )
              : [],
        };
      })
      .catch(() => ({
        authenticated: false,
        displayName: null,
        roles: [],
      }));
  }
  return initialSessionRequest;
}

export function PresentationIdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<PresentationIdentity | null>(null);
  const [status, setStatus] = useState<PresentationIdentityState["status"]>(
    "loading",
  );

  useEffect(() => {
    let active = true;
    void requestPresentationIdentity().then((nextIdentity) => {
      if (!active) return;
      setIdentity(nextIdentity);
      setStatus(nextIdentity.authenticated ? "authenticated" : "unauthenticated");
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<PresentationIdentityState>(
    () => ({
      status,
      identity,
      markUnauthenticated: () => {
        setIdentity({ authenticated: false, displayName: null, roles: [] });
        setStatus("unauthenticated");
      },
    }),
    [identity, status],
  );

  return (
    <PresentationIdentityContext.Provider value={value}>
      {children}
    </PresentationIdentityContext.Provider>
  );
}

export function usePresentationIdentity() {
  const value = useContext(PresentationIdentityContext);
  if (!value) {
    throw new Error("usePresentationIdentity must be used inside its provider");
  }
  return value;
}
