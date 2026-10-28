import Screen from "./Screen.jsx";

export default function AuthLoading() {
  return (
    <Screen title="Signing in" chrome={false}>
      <p className="center" role="status">
        Checking your session...
      </p>
    </Screen>
  );
}
