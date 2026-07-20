import { LoginButtons } from "./login-buttons";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold">Sign in to MicroManus</h1>
      <LoginButtons />
    </div>
  );
}
