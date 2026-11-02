import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  getSupabaseClient,
  googleSignInEnabled
} from "../lib/supabase.js";
import {
  authErrorMessage,
  authRedirectUrl,
  passwordValidationError
} from "../lib/auth.js";
import { readMfaSession, verifyTotp } from "../lib/mfa.js";

const emptyAuth = {
  user: null,
  hasSession: false,
  mfaRequired: false,
  mfaFactors: []
};

export function useAuthSession() {
  const client = getSupabaseClient();
  const sequence = useRef(0);
  const nextVersion = useCallback(() => ++sequence.current, []);
  const [auth, setAuth] = useState({
    ...emptyAuth,
    authLoading: Boolean(client),
    authError: ""
  });

  const synchronize = useCallback(
    async (session, version) => {
      try {
        const next = await readMfaSession(client, session);
        if (version !== sequence.current) return;
        setAuth({ ...next, authLoading: false, authError: "" });
      } catch (error) {
        if (version !== sequence.current) return;
        setAuth({
          ...emptyAuth,
          hasSession: Boolean(session),
          authLoading: false,
          authError: authErrorMessage(error)
        });
      }
    },
    [client]
  );

  const refreshAuth = useCallback(async () => {
    const version = nextVersion();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    await synchronize(data.session, version);
  }, [client, nextVersion, synchronize]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    let receivedEvent = false;
    let sessionUserId;
    const { data } = client.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        receivedEvent = true;
        const version = nextVersion();
        // SIGNED_IN also fires on focus: preserve unfinished authenticator setup.
        if (
          event === "INITIAL_SESSION" ||
          event === "SIGNED_OUT" ||
          (event === "SIGNED_IN" &&
            session?.user?.id !== sessionUserId)
        ) {
          setAuth((current) => ({
            ...current,
            user: null,
            authLoading: true
          }));
        }
        sessionUserId = session?.user?.id;
        // SDK callbacks run under its lock; defer calls until the callback exits.
        setTimeout(() => {
          if (active && version === sequence.current)
            void synchronize(session, version);
        }, 0);
      }
    );
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || receivedEvent) return;
        if (error) throw error;
        sessionUserId = data.session?.user?.id;
        return synchronize(data.session, nextVersion());
      })
      .catch((error) => {
        if (active && !receivedEvent)
          setAuth({
            ...emptyAuth,
            authLoading: false,
            authError: authErrorMessage(error)
          });
      });
    return () => {
      active = false;
      nextVersion();
      data.subscription.unsubscribe();
    };
  }, [client, nextVersion, synchronize]);

  function requireClient() {
    if (!client)
      throw new Error(
        "Sign-in is currently unavailable. Please try again later."
      );
    return client;
  }

  return {
    ...auth,
    refreshAuth,
    async verifyMfa(factorId, code) {
      await verifyTotp(requireClient(), factorId, code);
      await refreshAuth();
    },
    async signIn({ email, password }) {
      // Supabase Auth hashes passwords with bcrypt on the server. Do not store
      // passwords or replace them with a reusable client-generated hash.
      const { error } =
        await requireClient().auth.signInWithPassword({
          email: email.trim(),
          password
        });
      if (error) throw error;
    },
    async signUp({ name, email, password, destination }) {
      const validation = passwordValidationError(password);
      if (validation) throw new Error(validation);
      const { data, error } = await requireClient().auth.signUp(
        {
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: authRedirectUrl(
              window.location.origin,
              destination
            )
          }
        }
      );
      if (error) throw error;
      return data;
    },
    async signInWithGoogle(destination) {
      requireClient();
      if (!(await googleSignInEnabled()))
        throw Object.assign(
          new Error("Google sign-in is disabled."),
          { code: "provider_disabled" }
        );
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: authRedirectUrl(
            window.location.origin,
            destination
          ),
          queryParams: { prompt: "select_account" }
        }
      });
      if (error) throw error;
    },
    async signOut() {
      const { error } = await requireClient().auth.signOut({
        scope: "local"
      });
      if (error) throw error;
    },
    async signOutEverywhere() {
      const { error } = await requireClient().auth.signOut({
        scope: "global"
      });
      if (error) throw error;
    }
  };
}
