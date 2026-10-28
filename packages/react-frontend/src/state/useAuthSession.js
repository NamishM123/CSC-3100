import { useEffect, useState } from "react";
import {
  getSupabaseClient,
  googleSignInEnabled
} from "../lib/supabase.js";
import {
  appUser,
  authErrorMessage,
  authRedirectUrl
} from "../lib/auth.js";

export function useAuthSession() {
  const client = getSupabaseClient();
  const [auth, setAuth] = useState({
    user: null,
    authLoading: Boolean(client),
    authError: ""
  });

  useEffect(() => {
    if (!client) return;
    let active = true;
    let receivedEvent = false;

    const { data } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        receivedEvent = true;
        setAuth({
          user: appUser(session?.user),
          authLoading: false,
          authError: ""
        });
      }
    );

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || receivedEvent) return;
        setAuth({
          user: error ? null : appUser(data.session?.user),
          authLoading: false,
          authError: error ? authErrorMessage(error) : ""
        });
      })
      .catch((error) => {
        if (!active || receivedEvent) return;
        setAuth({
          user: null,
          authLoading: false,
          authError: authErrorMessage(error)
        });
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  function requireClient() {
    if (!client) {
      throw new Error(
        "Sign-in is currently unavailable. Please try again later."
      );
    }
    return client;
  }

  return {
    ...auth,
    async signIn({ email, password }) {
      const { error } =
        await requireClient().auth.signInWithPassword({
          email: email.trim(),
          password
        });
      if (error) throw error;
    },
    async signUp({ name, email, password, destination }) {
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
      if (!(await googleSignInEnabled())) {
        const error = new Error("Google sign-in is disabled.");
        error.code = "provider_disabled";
        throw error;
      }
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
    }
  };
}
