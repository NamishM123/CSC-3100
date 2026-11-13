import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { OverlayProvider } from "./Sheet.jsx";

const TABS = [
  { id: "home", label: "Home", to: "/" },
  { id: "list", label: "List", to: "/list" },
  { id: "stores", label: "Stores", to: "/stores" },
  { id: "profile", label: "Profile", to: "/profile" }
];

function tabFor(pathname) {
  if (pathname === "/list") return "list";
  if (pathname === "/stores") return "stores";
  if (pathname === "/profile") return "profile";
  if (pathname === "/" || pathname === "/search") return "home";
  return null;
}

function desktopTab(pathname) {
  if (
    pathname === "/list" ||
    pathname.startsWith("/list/") ||
    pathname === "/route"
  ) {
    return "list";
  }
  if (
    pathname === "/stores" ||
    pathname.startsWith("/stores/")
  ) {
    return "stores";
  }
  if (pathname === "/profile") return "profile";
  if (
    pathname === "/" ||
    pathname === "/search" ||
    pathname.startsWith("/product")
  ) {
    return "home";
  }
  return null;
}

function isPublic(pathname) {
  return (
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname.startsWith("/location")
  );
}

function NavigationIcon({ name }) {
  return (
    <svg
      className="nav-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false">
      {name === "home" ? (
        <>
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
          <path d="M9 21v-8h6v8" />
        </>
      ) : name === "list" ? (
        <>
          <rect x="5" y="4" width="15" height="17" rx="2" />
          <path d="M9 3h7v3H9zM8 11l1 1 2-2m3 1h3M8 16l1 1 2-2m3 1h3" />
        </>
      ) : name === "stores" ? (
        <>
          <path d="M4 10v11h16V10M3 10l2-7h14l2 7" />
          <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 21v-7h6v7" />
        </>
      ) : (
        <>
          <circle cx="12" cy="7" r="4" />
          <path d="M4 21v-2a8 8 0 0 1 16 0v2Z" />
        </>
      )}
    </svg>
  );
}

function DesktopNav({ pathname }) {
  const active = desktopTab(pathname);
  return (
    <header className="desktop-nav">
      <div className="desktop-nav-inner">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true" />
          Price Pantry
        </Link>
        <nav className="desktop-links" aria-label="Primary">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              to={tab.to}
              className={
                tab.id === active
                  ? "desktop-link active"
                  : "desktop-link"
              }
              aria-current={
                tab.id === active ? "page" : undefined
              }>
              <NavigationIcon name={tab.id} />
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function TabBar({ active }) {
  return (
    <nav className="tabs" aria-label="Primary">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          to={tab.to}
          className={tab.id === active ? "tab active" : "tab"}
          aria-current={tab.id === active ? "page" : undefined}>
          <NavigationIcon name={tab.id} />
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export default function PhoneShell() {
  const { pathname, search } = useLocation();
  const [node, setNode] = useState(null);
  const active = tabFor(pathname);

  useEffect(() => {
    document.querySelector(".screen-body")?.scrollTo(0, 0);
    document.querySelector(".phone-body")?.scrollTo(0, 0);
  }, [pathname, search]);

  return (
    <OverlayProvider node={node}>
      <div className="stage">
        <div className="phone">
          {isPublic(pathname) ? null : (
            <DesktopNav pathname={pathname} />
          )}
          <div className="phone-body">
            <Outlet />
          </div>
          {active ? <TabBar active={active} /> : null}
          <div className="overlay-root" ref={setNode} />
        </div>
      </div>
    </OverlayProvider>
  );
}
