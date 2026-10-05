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

function StatusBar() {
  return (
    <div className="status" aria-hidden="true">
      <span>9:41</span>
      <span className="status-right">
        LTE
        <svg width="22" height="12" viewBox="0 0 22 12">
          <rect
            x="0.6"
            y="0.6"
            width="18"
            height="10.8"
            rx="2"
            fill="none"
            stroke="currentColor"
          />
          <rect x="2" y="2" width="15" height="8" rx="1" />
          <rect
            x="19.5"
            y="3.5"
            width="1.8"
            height="5"
            rx="0.6"
          />
        </svg>
        100%
      </span>
    </div>
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
          <span className="tab-icon" />
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
          <StatusBar />
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
