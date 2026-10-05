import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation
} from "react-router-dom";
import PhoneShell from "./components/PhoneShell.jsx";
import Home from "./pages/Home.jsx";
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
  const { user } = useAppState();
  const route = useLocation();
  if (!user) {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: route.pathname + route.search }}
      />
    );
  }
  return <Outlet />;
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
