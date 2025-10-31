import AppShell from "./_components/AppShell";
import LoginForm from "./_components/LoginForm";
import { isAuthenticated, resolveAppPassword } from "@/lib/auth";
import { getDatasetsWithSchema } from "@/lib/schema";

export default async function Home() {
  const authenticated = await isAuthenticated();
  const passwordConfigured = Boolean(resolveAppPassword());

  if (!authenticated) {
    return <LoginForm passwordConfigured={passwordConfigured} />;
  }

  const datasets = await getDatasetsWithSchema();
  return <AppShell datasets={datasets} />;
}
