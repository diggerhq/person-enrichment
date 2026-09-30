import Experience from "./experience";
export default function Page() {
  const repository = process.env.TEMPLATE_REPOSITORY_URL || "";
  const deployUrl = repository
    ? `https://app.opencomputer.dev/new?repository-url=${encodeURIComponent(repository)}`
    : "";
  return <Experience deployUrl={deployUrl} repository={repository} />;
}
