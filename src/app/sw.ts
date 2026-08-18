import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// Minimal local typing for the push/notificationclick APIs: the project's tsconfig only
// loads the "dom" lib (not "webworker"), and mixing the two project-wide is fragile, so
// these are typed just enough for this file rather than pulling in the full worker lib.
interface PushEventLike extends Event {
  data?: { json: () => { title?: string; body?: string; url?: string } };
  waitUntil: (promise: Promise<unknown>) => void;
}

interface NotificationClickEventLike extends Event {
  notification: { close: () => void; data?: { url?: string } };
  waitUntil: (promise: Promise<unknown>) => void;
}

interface ServiceWorkerScopeLike {
  registration: { showNotification: (title: string, options: NotificationOptions) => Promise<void> };
  clients: { openWindow: (url: string) => Promise<unknown> };
  addEventListener: (type: string, listener: (event: never) => void) => void;
}

const swSelf = self as unknown as ServiceWorkerScopeLike;

swSelf.addEventListener("push", (event: PushEventLike) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    swSelf.registration.showNotification(data.title ?? "TimeBud", {
      body: data.body,
      icon: "/icon-192x192.png",
      data: { url: data.url ?? "/" },
    })
  );
});

swSelf.addEventListener("notificationclick", (event: NotificationClickEventLike) => {
  event.notification.close();
  event.waitUntil(swSelf.clients.openWindow(event.notification.data?.url ?? "/"));
});
