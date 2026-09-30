"use client";

import { useId, useState, type ReactNode } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners,
  useDroppable, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, CheckCircle2, Circle, GripVertical, LayoutGrid, List, Plus, RotateCcw, Search, Table2 } from "lucide-react";
import type { Task } from "@/lib/api";
import { dueDateLocal, moveTask } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const columns: { id: Task["status"]; label: string; color: string }[] = [
  { id: "todo", label: "To do", color: "#b88931" },
  { id: "in-progress", label: "In progress", color: "#4f79c7" },
  { id: "in-review", label: "In review", color: "#d66b55" },
  { id: "completed", label: "Completed", color: "#087f70" },
];
const views = [
  { label: "Board", icon: LayoutGrid }, { label: "List", icon: List },
  { label: "Table", icon: Table2 }, { label: "Timeline", icon: CalendarDays },
] as const;
type View = typeof views[number]["label"];
const priorities: Task["priority"][] = ["low", "medium", "high"];
const priorityStyles = {
  low: "bg-[#edf3fc] text-[#4169ab]",
  medium: "bg-[#fbf1df] text-[#90681f]",
  high: "bg-[#fcece8] text-[#ad503c]",
};
const dates = Array.from({ length: 8 }, (_, index) => `2026-10-0${index + 1}`);
const selectClass = "h-8 min-w-0 rounded-md border border-[#e4e7eb] bg-white px-2 text-[12px] text-[#171b22] focus-visible:outline-[#087f70]";

const sampleTasks: Task[] = [
  ["Map onboarding flow", "todo", "medium", 5],
  ["Define release checklist", "todo", "low", 8],
  ["Refine authentication", "in-progress", "high", 3],
  ["Polish task interactions", "in-progress", "medium", 6],
  ["Review mobile layouts", "in-review", "high", 4],
  ["Check keyboard navigation", "in-review", "medium", 7],
  ["Ship workspace update", "completed", "low", 1],
  ["Organize project labels", "completed", "low", 2],
].map(([title, status, priority, day], index) => ({
  id: `preview-task-${index + 1}`, title: title as string,
  status: status as Task["status"], priority: priority as Task["priority"],
  position: (index % 2 + 1) * 1024, dueDate: `2026-10-0${day}`,
  ownerId: "preview-owner", workspaceId: "preview-workspace", createdAt: "2026-10-01T09:00:00.000Z",
}));

function Priority({ priority }: { priority: Task["priority"] }) {
  return <span className={`inline-flex h-5 items-center rounded px-1.5 text-[12px] capitalize ${priorityStyles[priority]}`}>{priority}</span>;
}

function DueDate({ value }: { value: Task["dueDate"] }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-[#68717f]">
    <CalendarDays aria-hidden="true" className="size-3.5" />
    {value ? <time dateTime={value}>{dueDateLocal(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time> : "No due date"}
  </span>;
}

function Completion({ task, onToggle }: { task: Task; onToggle: (task: Task) => void }) {
  const label = `${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`;
  return <Button type="button" variant="ghost" size="icon" className="size-7 text-[#087f70]" aria-label={label} title={label} onClick={() => onToggle(task)}>
    {task.status === "completed" ? <CheckCircle2 /> : <Circle />}
  </Button>;
}

function TaskCard({ task, onToggle, handle }: { task: Task; onToggle: (task: Task) => void; handle?: ReactNode }) {
  return <article className="flex h-[76px] min-w-0 flex-col justify-between rounded-lg border border-[#e4e7eb] bg-white px-3 py-2 text-[13px] text-[#171b22]">
    <div className="flex min-w-0 items-center gap-1">
      <span title={task.title} className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
      {handle}
      <Completion task={task} onToggle={onToggle} />
    </div>
    <div className="flex items-center gap-4"><Priority priority={task.priority} /><DueDate value={task.dueDate} /></div>
  </article>;
}

function SortableCard({ task, onToggle, reduced }: { task: Task; onToggle: (task: Task) => void; reduced: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition: reduced ? undefined : transition, opacity: isDragging ? 0.3 : 1 }}>
    <TaskCard task={task} onToggle={onToggle} handle={
      <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Move ${task.title}`} title={`Move ${task.title}`} className="flex size-7 shrink-0 touch-none items-center justify-center rounded text-[#68717f] hover:bg-[#f5f6f8] focus-visible:outline-[#087f70]">
        <GripVertical aria-hidden="true" className="size-3.5" />
      </button>
    } />
  </div>;
}

function BoardColumn({ column, tasks, onToggle, onAdd, reduced }: {
  column: typeof columns[number]; tasks: Task[]; onToggle: (task: Task) => void;
  onAdd: (status: Task["status"]) => void; reduced: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return <section ref={setNodeRef} aria-label={column.label} className={`min-w-0 rounded-lg ${isOver ? "bg-[#e9efed]" : ""}`}>
    <div className="mb-2 flex h-7 items-center gap-2 px-1">
      <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: column.color }} />
      <h3 className="text-[13px] font-semibold">{column.label}</h3><span className="text-[12px] text-[#68717f]">{tasks.length}</span>
      <Button type="button" variant="ghost" size="icon" className="ml-auto size-7 text-[#68717f]" title={`Add task to ${column.label}`} aria-label={`Add task to ${column.label}`} onClick={() => onAdd(column.id)}><Plus /></Button>
    </div>
    <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
      <div className="min-h-[162px] space-y-2.5">{tasks.map(task => <SortableCard key={task.id} task={task} onToggle={onToggle} reduced={reduced} />)}</div>
    </SortableContext>
    <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 text-[12px] text-[#68717f]" onClick={() => onAdd(column.id)}><Plus />Add task</Button>
  </section>;
}

export function WorkspacePreview() {
  const id = useId();
  const reduced = Boolean(useReducedMotion());
  const [tasks, setTasks] = useState<Task[]>(sampleTasks);
  const [view, setView] = useState<View>("Board");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [newStatus, setNewStatus] = useState<Task["status"]>("todo");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("medium");
  const [newDate, setNewDate] = useState(dates[7]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, scrollBehavior: reduced ? "auto" : "smooth" }),
  );
  const visible = tasks.filter(task => task.title.toLowerCase().includes(query.trim().toLowerCase()) && (priority === "all" || task.priority === priority));
  const active = tasks.find(task => task.id === activeId);

  function toggle(task: Task) {
    const status = task.status === "completed" ? "todo" : "completed";
    setTasks(current => moveTask(current, task.id, status));
    setAnnouncement(`${task.title} ${status === "completed" ? "completed" : "reopened"}.`);
  }
  function changeStatus(task: Task, status: Task["status"]) {
    setTasks(current => moveTask(current, task.id, status));
    setAnnouncement(`${task.title} moved to ${columns.find(column => column.id === status)?.label}.`);
  }
  function openNew(status: Task["status"] = "todo") {
    setTitle(""); setNewStatus(status); setNewPriority("medium"); setNewDate(dates[7]); setDialogOpen(true);
  }
  function reset() {
    setTasks(sampleTasks); setQuery(""); setPriority("all"); setActiveId(null); setView("Board"); setDialogOpen(false);
    setAnnouncement("Preview workspace reset to eight sample tasks.");
  }
  function finishDrag({ active: dragged, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || dragged.id === over.id) return;
    const task = tasks.find(item => item.id === dragged.id);
    const status = tasks.find(item => item.id === over.id)?.status ?? columns.find(column => column.id === over.id)?.id;
    setTasks(current => moveTask(current, String(dragged.id), String(over.id)));
    if (task && status) setAnnouncement(`${task.title} moved to ${columns.find(column => column.id === status)?.label}.`);
  }
  function statusControl(task: Task) {
    return <select aria-label={`Status for ${task.title}`} className={`${selectClass} w-[120px]`} value={task.status} onChange={event => changeStatus(task, event.target.value as Task["status"])}>
      {columns.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}
    </select>;
  }

  return <section id="preview" aria-labelledby={`${id}-heading`} className="w-full min-w-0 bg-[#f5f6f8] text-[#171b22]">
    <div className="mx-auto w-full min-w-0 max-w-[1440px] px-4 py-5 sm:px-8 lg:px-12">
      <div className="mb-4 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
        <div className="mr-auto shrink-0">
          <h2 id={`${id}-heading`} className="text-[20px] font-semibold leading-7">Website refresh</h2>
          <p className="text-[12px] text-[#68717f]">Preview workspace</p>
        </div>
        <div role="tablist" aria-label="Preview views" className="relative flex max-w-full items-center rounded-md border border-[#e4e7eb] p-0.5" onKeyDown={event => {
          const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
          if (!keys.includes(event.key)) return;
          event.preventDefault();
          const index = views.findIndex(item => item.label === view);
          const next = event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + views.length) % views.length;
          setView(views[next].label);
          event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
        }}>
          {views.map(({ label, icon: Icon }) => <button key={label} id={`${id}-${label}-tab`} role="tab" type="button" aria-selected={view === label} aria-controls={`${id}-panel`} tabIndex={view === label ? 0 : -1} onClick={() => setView(label)} className={`relative flex h-8 items-center gap-1.5 rounded px-2 text-[12px] sm:px-3 ${view === label ? "text-[#087f70]" : "text-[#68717f]"}`}>
            {view === label && <motion.span layoutId={`${id}-selected-view`} transition={reduced ? { duration: 0 } : undefined} className="absolute inset-0 rounded border border-[#e4e7eb] bg-white" />}
            <Icon aria-hidden="true" className="relative size-3.5" /><span className="relative">{label}</span>
          </button>)}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-none">
          <div className="relative min-w-[140px] flex-1 sm:w-[180px] sm:flex-none">
            <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-[#68717f]" />
            <Input aria-label="Search preview tasks" placeholder="Search tasks..." value={query} onChange={event => setQuery(event.target.value)} className="h-8 pl-8 text-[12px] shadow-none md:text-[12px]" />
          </div>
          <select aria-label="Filter preview tasks by priority" className={`${selectClass} w-[110px]`} value={priority} onChange={event => setPriority(event.target.value)}>
            <option value="all">All priorities</option>{priorities.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
          </select>
          <Button type="button" variant="ghost" size="icon" className="size-8 text-[#68717f]" aria-label="Reset preview workspace" title="Reset preview workspace" onClick={reset}><RotateCcw /></Button>
          <Button type="button" size="sm" className="h-8 bg-[#087f70] text-[12px] text-white" onClick={() => openNew()}><Plus />New task</Button>
        </div>
      </div>

      <DndContext id={`${id}-dnd`} sensors={sensors} collisionDetection={closestCorners} onDragStart={event => setActiveId(String(event.active.id))} onDragEnd={finishDrag} onDragCancel={() => { setActiveId(null); setAnnouncement("Task move cancelled."); }} accessibility={{ announcements: {
        onDragStart({ active: dragged }) { return `Picked up ${tasks.find(task => task.id === dragged.id)?.title}. Use arrow keys to move, Space to drop, Escape to cancel.`; },
        onDragOver({ over }) { return over ? `Over ${tasks.find(task => task.id === over.id)?.title ?? columns.find(column => column.id === over.id)?.label}.` : "Outside the board."; },
        onDragEnd({ active: dragged, over }) { return `${tasks.find(task => task.id === dragged.id)?.title} ${over ? "dropped" : "move cancelled"}.`; },
        onDragCancel() { return "Task move cancelled."; },
      } }}>
        <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${view}-tab`} tabIndex={0} className="landing-preview-content w-full min-w-0 overflow-auto overscroll-x-contain">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: reduced ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.12 }}>
              {visible.length === 0 ? <div role="status" className="flex h-[180px] flex-col items-center justify-center gap-3 text-[13px] text-[#68717f]">
                <p>No tasks match your search.</p><Button type="button" variant="outline" size="sm" onClick={() => { setQuery(""); setPriority("all"); }}>Clear filters</Button>
              </div> : view === "Board" ? <div className="grid min-w-[1040px] grid-cols-4 gap-6">
                {columns.map(column => <BoardColumn key={column.id} column={column} tasks={visible.filter(task => task.status === column.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))} onToggle={toggle} onAdd={openNew} reduced={reduced} />)}
              </div> : view === "List" ? <div className="space-y-4">
                {columns.map(column => <section key={column.id} aria-label={column.label}>
                  <h3 className="mb-1 flex items-center gap-2 text-[12px] font-semibold"><span aria-hidden="true" className="size-2 rounded-full" style={{ background: column.color }} />{column.label}</h3>
                  {visible.filter(task => task.status === column.id).map(task => <div key={task.id} className="flex min-w-0 flex-wrap items-center gap-2 border-b border-[#e4e7eb] py-2 text-[13px]">
                    <Completion task={task} onToggle={toggle} /><span className="min-w-[120px] flex-1 truncate" title={task.title}>{task.title}</span>
                    <Priority priority={task.priority} /><DueDate value={task.dueDate} />{statusControl(task)}
                  </div>)}
                </section>)}
              </div> : view === "Table" ? <table className="w-full min-w-[680px] border-collapse text-left text-[13px]">
                <thead className="text-[12px] text-[#68717f]"><tr>{["Task", "Status", "Priority", "Due date", "Complete"].map(label => <th key={label} scope="col" className="border-b border-[#e4e7eb] px-3 py-2 font-medium">{label}</th>)}</tr></thead>
                <tbody>{visible.map(task => <tr key={task.id} className="border-b border-[#e4e7eb]">
                  <td className="max-w-[280px] truncate px-3 py-2" title={task.title}>{task.title}</td><td className="px-3 py-2">{statusControl(task)}</td>
                  <td className="px-3 py-2"><Priority priority={task.priority} /></td><td className="px-3 py-2"><DueDate value={task.dueDate} /></td><td className="px-3 py-2"><Completion task={task} onToggle={toggle} /></td>
                </tr>)}</tbody>
              </table> : <div className="min-w-[860px]">
                <div className="grid grid-cols-[260px_repeat(8,minmax(0,1fr))] border-b border-[#e4e7eb] text-center text-[12px] text-[#68717f]"><span className="py-2 text-left">October 2026</span>{dates.map(date => <span key={date} className="py-2">Oct {Number(date.slice(-2))}</span>)}</div>
                {visible.map(task => <div key={task.id} className="grid grid-cols-[260px_repeat(8,minmax(0,1fr))] items-center border-b border-[#e4e7eb] text-[13px]">
                  <div className="flex min-w-0 items-center gap-2 py-1"><Completion task={task} onToggle={toggle} /><span className="truncate" title={task.title}>{task.title}</span></div>
                  {dates.map(date => <div key={date} className="flex h-9 items-center justify-center border-l border-[#e4e7eb]">
                    {task.dueDate === date && <span title={`${task.title}, due October ${Number(date.slice(-2))}`} className="flex h-5 w-[85%] items-center justify-center rounded text-[11px] text-white" style={{ background: columns.find(column => column.id === task.status)?.color }}>{task.priority}<span className="sr-only">, due October {Number(date.slice(-2))}</span></span>}
                  </div>)}
                </div>)}
              </div>}
            </motion.div>
          </AnimatePresence>
        </div>
        <DragOverlay dropAnimation={reduced ? null : undefined}>{active ? <div className="pointer-events-none" aria-hidden="true"><TaskCard task={active} onToggle={toggle} /></div> : null}</DragOverlay>
      </DndContext>
      <p aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
    </div>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>New task</DialogTitle><DialogDescription>Preview workspace</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={event => {
          event.preventDefault();
          if (!title.trim()) return;
          const task: Task = {
            id: `preview-${crypto.randomUUID()}`, title: title.trim(), status: newStatus, priority: newPriority,
            position: Math.max(0, ...tasks.filter(item => item.status === newStatus).map(item => item.position)) + 1024,
            dueDate: newDate || null, ownerId: "preview-owner", workspaceId: "preview-workspace", createdAt: new Date().toISOString(),
          };
          setTasks(current => [...current, task]); setQuery(""); setPriority("all"); setDialogOpen(false); setAnnouncement(`${task.title} created in Preview workspace.`);
        }}>
          <div className="space-y-2"><Label htmlFor={`${id}-title`}>Title</Label><Input id={`${id}-title`} autoFocus required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor={`${id}-status`}>Status</Label><select id={`${id}-status`} className={`${selectClass} w-full`} value={newStatus} onChange={event => setNewStatus(event.target.value as Task["status"])}>{columns.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor={`${id}-priority`}>Priority</Label><select id={`${id}-priority`} className={`${selectClass} w-full`} value={newPriority} onChange={event => setNewPriority(event.target.value as Task["priority"])}>{priorities.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></div>
          </div>
          <div className="space-y-2"><Label htmlFor={`${id}-date`}>Due date</Label><Input id={`${id}-date`} type="date" min={dates[0]} max={dates[7]} value={newDate} onChange={event => setNewDate(event.target.value)} /></div>
          <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={!title.trim()}>Create task</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
