import { getSupabaseClient } from "./supabase.js";
import {
  notificationPermission,
  notificationRegistration
} from "./browserNotifications.js";

async function request(method, body) {
  const client = getSupabaseClient();
  if (!client)
    throw new Error(
      "Sign in before setting up background notifications."
    );
  const { data, error } = await client.auth.getSession();
  if (error || !data.session)
    throw new Error("Sign in again to manage notifications.");
  let response;
  try {
    response = await fetch("/api/notifications", {
      method,
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(45000)
    });
  } catch {
    throw new Error(
      "The local notification server is unreachable. Start npm run dev:local and check your connection."
    );
  }
  if (
    !response.headers
      .get("Content-Type")
      ?.includes("application/json")
  )
    throw new Error(
      "Start npm run dev:local to use local background delivery."
    );
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(result.error || "Notification request failed."),
      { status: response.status }
    );
  return result;
}

function keyBytes(value) {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (character) => character.charCodeAt(0)
  );
}

function subscribe(manager, key) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        reject(
          new Error(
            "The browser's push service did not respond. Check your connection or choose alerts while the app is open."
          )
        ),
      30000
    );
    manager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: key
      })
      .then(resolve, reject)
      .finally(() => clearTimeout(timeout));
  });
}

export async function enablePush(watch) {
  if (!("PushManager" in window))
    throw new Error(
      "Background push isn't supported here. Choose alerts while the app is open."
    );
  const config = await request("GET");
  const registration = await notificationRegistration();
  let subscription =
    await registration.pushManager.getSubscription();
  const key = keyBytes(config.publicKey);
  const oldKey =
    subscription?.options.applicationServerKey &&
    new Uint8Array(subscription.options.applicationServerKey);
  if (
    subscription &&
    oldKey &&
    (oldKey.length !== key.length ||
      oldKey.some((value, index) => value !== key[index]))
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ||= await subscribe(
    registration.pushManager,
    key
  );
  try {
    return await request("PUT", {
      subscription: subscription.toJSON(),
      watch
    });
  } catch (error) {
    if (error.status !== 409) throw error;
    await subscription.unsubscribe();
    subscription = await subscribe(
      registration.pushManager,
      key
    );
    return request("PUT", {
      subscription: subscription.toJSON(),
      watch
    });
  }
}

async function subscription() {
  const registration = await notificationRegistration();
  const result =
    await registration.pushManager.getSubscription();
  if (!result)
    throw new Error(
      "This device's push subscription expired. Turn notifications off and on again."
    );
  return result;
}

export async function syncPush(watch) {
  return request("PUT", {
    subscription: (await subscription()).toJSON(),
    watch
  });
}
export async function pushAction(action) {
  return request("POST", {
    endpoint: (await subscription()).endpoint,
    action
  });
}

export async function disablePush(all = false) {
  let serverRemoved = false;
  if (all) {
    try {
      await request("DELETE", { all: true });
      serverRemoved = true;
    } catch {
      /* Auth sign-out still works offline. */
    }
  }
  if (notificationPermission() === "unsupported")
    return { serverRemoved };
  const registration = await notificationRegistration();
  const saved =
    await registration.pushManager.getSubscription();
  try {
    if (saved && !all)
      await request("DELETE", { endpoint: saved.endpoint });
    if (!all) serverRemoved = true;
  } catch {
    /* Unsubscribing locally also prevents delivery if the server is down. */
  }
  if (saved && !(await saved.unsubscribe()))
    throw new Error(
      "The browser could not unsubscribe. Retry or block notifications in site settings."
    );
  return { serverRemoved };
}
