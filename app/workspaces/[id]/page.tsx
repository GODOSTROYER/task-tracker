import TaskBoard from "@/components/task-board";

// Next.js 15: params is a Promise
export default async function WorkspaceTasksPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <TaskBoard key={params.id} workspaceId={params.id} />;
}
