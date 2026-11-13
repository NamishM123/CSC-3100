import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation
} from "react-router-dom";
import PhoneShell from "./components/PhoneShell.jsx";
import AuthLoading from "./components/AuthLoading.jsx";
import Home from "./pages/Home.jsx";
import AccountSecurity from "./pages/AccountSecurity.jsx";
import { AllowLocation, EnterZip } from "./pages/Location.jsx";
import Missing from "./pages/Missing.jsx";
import Optimized from "./pages/Optimized.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Profile from "./pages/Profile.jsx";
import RoutePlan from "./pages/RoutePlan.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import ShoppingList from "./pages/ShoppingList.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import StoreDetail from "./pages/StoreDetail.jsx";
import Stores from "./pages/Stores.jsx";
import { AppStateProvider } from "./state/AppState.jsx";
import { useAppState } from "./state/useAppState.js";

function RequireAuth() {
  const { user, authLoading, listSync, signOut } =
    useAppState();
  const route = useLocation();
  if (authLoading) return <AuthLoading />;
  if (!user) {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: route.pathname + route.search }}
      />
    );
  }
  if (!listSync.ready)
    return (
      <div className="card stack" role="status">
        <p>
          {listSync.status === "error"
            ? listSync.message
            : "Loading your saved lists..."}
        </p>
        {listSync.status === "error" ? (
          <button
            className="btn primary"
            onClick={listSync.reload}>
            Retry
          </button>
        ) : null}
        <button
          className="text-link"
          onClick={() => {
            void signOut();
          }}>
          Sign out
        </button>
      </div>
    );
  return (
    <>
      <div className="list-sync-status" role="status">
        {listSync.status === "error" ? (
          <>
            <span>{listSync.message}</span>{" "}
            <button
              className="text-link"
              onClick={
                listSync.conflict
                  ? listSync.reload
                  : () => {
                      void listSync.flush().catch(() => {});
                    }
              }>
              {listSync.conflict
                ? "Reload saved lists"
                : "Retry saving"}
            </button>
          </>
        ) : listSync.pending || listSync.status === "saving" ? (
          "Saving lists..."
        ) : (
          "Lists saved to your account"
        )}
      </div>
      {listSync.conflict ? (
        <p className="banner warn">
          Reload saved lists to continue. Unsaved changes in
          this tab will be replaced.
        </p>
      ) : (
        <Outlet />
      )}
    </>
  );
}

function RequirePlace() {
  const { location } = useAppState();
  const route = useLocation();
  if (!location) {
    return (
      <Navigate
        to="/location"
        replace
        state={{ from: route.pathname + route.search }}
      />
    );
  }
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PhoneShell />}>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route element={<RequireAuth />}>
          <Route
            path="/account-security"
            element={<AccountSecurity />}
          />
          <Route path="/location" element={<AllowLocation />} />
          <Route path="/location/zip" element={<EnterZip />} />
          <Route element={<RequirePlace />}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<SearchResults />} />
            <Route
              path="/product/:productId"
              element={<ProductDetail />}
            />
            <Route path="/list" element={<ShoppingList />} />
            <Route
              path="/list/optimize"
              element={<Optimized />}
            />
            <Route path="/route" element={<RoutePlan />} />
            <Route path="/stores" element={<Stores />} />
            <Route
              path="/stores/:storeId"
              element={<StoreDetail />}
            />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
        <Route path="*" element={<Missing />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppStateProvider>
        <AppRoutes />
      </AppStateProvider>
    </BrowserRouter>
  );
}
