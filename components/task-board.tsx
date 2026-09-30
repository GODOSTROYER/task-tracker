"use client";

import { useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { api, getToken, type Task } from "@/lib/api";
import { useWorkspaces } from "@/lib/contexts/WorkspacesContext";
import { moveTask, dueDateLocal, isTaskOverdue } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Pencil, Trash2, X, ChevronDown, ChevronRight, CheckCircle2, Circle, Clock, LayoutGrid, List, Table2, CalendarDays, ArrowUp, ArrowDown, ArrowUpDown, Search, SlidersHorizontal, GripVertical } from "lucide-react";
import { DndContext, DragOverlay, useSensors, useSensor, PointerSensor, KeyboardSensor, closestCorners, type DragStartEvent, type DragEndEvent, defaultDropAnimationSideEffects, type DropAnimation, useDroppable } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const BoardTime = createContext(new Date(0));
const BoardInteraction = createContext({ locked: false, reduced: false });
const easeOut = [0.22, 1, 0.36, 1] as const;
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087f70]/40 focus-visible:ring-offset-2";
const actionClass = "rounded-md bg-[#087f70] text-white hover:bg-[#06695d]";
const fieldClass = "w-full rounded-md border-[#e4e7eb] text-[#171b22] focus-visible:border-[#087f70] focus-visible:ring-[#087f70]/20";
const dialogClass = "max-h-[85dvh] overflow-y-auto rounded-lg border-[#e4e7eb] bg-white p-5 text-[#171b22] shadow-xl sm:p-6";
const VIEW_MODES = [
  { id: "Board", icon: LayoutGrid }, { id: "List", icon: List },
  { id: "Table", icon: Table2 }, { id: "Timeline", icon: CalendarDays },
];
const COLUMNS = [
  { id: "todo", label: "To do", color: "bg-[#b88931]" },
  { id: "in-progress", label: "In progress", color: "bg-[#4f79c7]" },
  { id: "in-review", label: "In review", color: "bg-[#d66b55]" },
  { id: "completed", label: "Completed", color: "bg-[#087f70]" },
];
const PRIORITY_META: Record<string, { label: string; color: string }> = {
  high: { label: "High", color: "bg-[#fbe8e4] text-[#a84432]" },
  medium: { label: "Medium", color: "bg-[#faf0d9] text-[#85631c]" },
  low: { label: "Low", color: "bg-[#e2f2ec] text-[#236b57]" },
};

function TaskStatusIcon({ task }: { task: Task }) {
  const now = useContext(BoardTime);
  if (task.status === "completed") return <CheckCircle2 className="h-4 w-4 text-[#087f70]" />;
  if (task.status === "todo") return <Circle className="h-4 w-4 text-[#b88931]" />;
  const urgent = task.dueDate && dueDateLocal(task.dueDate).getTime() - now.getTime() <= 86400000 && !isTaskOverdue(task.dueDate, task.status, now);
  return <Clock className={cn("h-4 w-4", urgent ? "text-[#b88931]" : "text-[#68717f]")} />;
}

function StatusBadge({ status }: { status: string }) {
  const col = COLUMNS.find(column => column.id === status) ?? COLUMNS[0];
  return <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-[#68717f]"><span className={cn("h-2 w-2 shrink-0 rounded-full", col.color)} />{col.label}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.medium;
  return <span className={cn("inline-flex shrink-0 items-center rounded px-2 py-1 text-xs font-medium leading-none", meta.color)}>{meta.label}</span>;
}

function DueDateChip({ task, year = false }: { task: Task; year?: boolean }) {
  const now = useContext(BoardTime);
  if (!task.dueDate) return null;
  const overdue = isTaskOverdue(task.dueDate, task.status, now);
  return <span className={cn("inline-flex flex-wrap items-center gap-1.5 text-xs", overdue ? "text-[#b6513e]" : "text-[#68717f]")}>
    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
    <time dateTime={task.dueDate.slice(0, 10)}>{dueDateLocal(task.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) })}</time>
    {overdue && <span className="rounded bg-[#fbe8e4] px-1.5 py-0.5 text-[10px] font-medium">Overdue</span>}
  </span>;
}

interface TaskDialogProps {
  task?: Task; initialStatus?: string; onClose: () => void; restoreFocus: () => void;
  onSave: (data: Partial<Task>) => Promise<void>; onDelete?: () => Promise<void>;
}

function TaskDialog({ task, initialStatus = "todo", onClose, restoreFocus, onSave, onDelete }: TaskDialogProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [desc, setDesc] = useState(task?.description ?? "");
  const [status, setStatus] = useState<string>(task?.status ?? initialStatus);
  const [priority, setPriority] = useState<string>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const reduced = useReducedMotion();
  const prefix = task ? "edit-task" : "create-task";
  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true); setError("");
    try {
      await onSave({ title: title.trim(), description: desc, status: status as Task["status"], priority: priority as Task["priority"], dueDate: dueDate || (task ? null : undefined) });
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save task."); }
    finally { setSaving(false); }
  };
  const handleDelete = async () => {
    if (saving || !onDelete) return;
    setSaving(true); setError("");
    try { await onDelete(); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to delete task."); }
    finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={value => !value && !saving && onClose()}>
    <DialogContent aria-describedby={undefined} className={cn(dialogClass, "sm:max-w-lg")} showCloseButton={false} onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>
      <DialogHeader className="flex-row items-center justify-between gap-3 text-left"><DialogTitle className="text-lg">{task ? "Edit task" : "New task"}</DialogTitle><button type="button" aria-label="Close task dialog" title="Close" disabled={saving} onClick={onClose} className={cn(focusRing, "rounded p-1.5 text-[#68717f] hover:bg-[#f5f6f8]")}><X className="h-4 w-4" /></button></DialogHeader>
      <form onSubmit={event => { event.preventDefault(); void handleSave(); }} className="space-y-5" aria-busy={saving}>
        <AnimatePresence initial={false}>{error && <motion.p key="error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.15 }} className="rounded-md bg-[#fbe8e4] p-3 text-sm text-[#a84432]">{error}</motion.p>}</AnimatePresence>
        <fieldset disabled={saving} className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`${prefix}-title`}>Title</Label><Input id={`${prefix}-title`} value={title} onChange={event => setTitle(event.target.value)} required maxLength={255} autoFocus className={fieldClass} /></div>
          <div className="space-y-2"><Label htmlFor={`${prefix}-description`}>Description</Label><Textarea id={`${prefix}-description`} value={desc} onChange={event => setDesc(event.target.value)} className={cn(fieldClass, "min-h-24 resize-y")} /></div>
          <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
            <div className="space-y-2"><Label htmlFor={`${prefix}-status`}>Status</Label><Select value={status} onValueChange={setStatus} disabled={saving}><SelectTrigger id={`${prefix}-status`} className={fieldClass}><SelectValue /></SelectTrigger><SelectContent>{COLUMNS.map(col => <SelectItem key={col.id} value={col.id}>{col.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor={`${prefix}-priority`}>Priority</Label><Select value={priority} onValueChange={setPriority} disabled={saving}><SelectTrigger id={`${prefix}-priority`} className={fieldClass}><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PRIORITY_META).map(([value, meta]) => <SelectItem key={value} value={value}>{meta.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label htmlFor={`${prefix}-date`}>Due date</Label><Input id={`${prefix}-date`} type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className={fieldClass} /></div>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4e7eb] pt-4">
          {task ? <AnimatePresence initial={false} mode="wait">{confirming ? <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.12 }} className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[#a84432]">Delete this task?</span><Button type="button" size="sm" variant="destructive" disabled={saving} onClick={handleDelete}>Delete</Button><Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setConfirming(false)}>Cancel</Button>
          </motion.div> : <motion.div key="delete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.12 }}><Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setConfirming(true)} className="text-[#a84432] hover:bg-[#fbe8e4] hover:text-[#a84432]"><Trash2 className="h-4 w-4" />Delete</Button></motion.div>}</AnimatePresence> : <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>}
          <Button type="submit" disabled={!title.trim() || saving} className={actionClass}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Saving..." : task ? "Save changes" : "Create task"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

function TaskCard({ task, onEdit, dragHandle }: { task: Task; onEdit?: () => void; dragHandle?: React.ReactNode }) {
  const { locked, reduced } = useContext(BoardInteraction);
  return <motion.div initial={false} whileHover={locked || reduced ? undefined : { boxShadow: "0 4px 14px rgba(23,27,34,0.06)" }} transition={{ duration: 0.16 }} className="relative min-w-0 rounded-lg border border-[#e4e7eb] bg-white p-4">
    <div className="flex items-start gap-2">
      {onEdit ? <button type="button" disabled={locked} onClick={onEdit} className={cn(focusRing, "min-w-0 flex-1 rounded text-left text-sm font-semibold leading-5 text-[#171b22] [overflow-wrap:anywhere] hover:text-[#087f70]")} aria-label={`Edit ${task.title}`}>{task.title}</button> : <p className="min-w-0 flex-1 text-sm font-semibold leading-5 [overflow-wrap:anywhere]">{task.title}</p>}
      {dragHandle}
    </div>
    {task.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#68717f] [overflow-wrap:anywhere]">{task.description}</p>}
    <div className="mt-3"><PriorityBadge priority={task.priority} /></div>
    {task.dueDate && <div className="mt-3"><DueDateChip task={task} /></div>}
  </motion.div>;
}

function SortableTask({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const { locked, reduced } = useContext(BoardInteraction);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { task }, disabled: locked });
  // This outer node's transform belongs exclusively to dnd-kit.
  return <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition: reduced ? undefined : transition, opacity: isDragging ? 0.35 : 1 }}>
    <TaskCard task={task} onEdit={onEdit} dragHandle={<button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} disabled={locked} aria-label={`Move ${task.title}`} title="Move task" className={cn(focusRing, "-mr-1 shrink-0 touch-none rounded p-1 text-[#9aa1ab] hover:bg-[#f5f6f8] hover:text-[#68717f] disabled:cursor-default cursor-grab active:cursor-grabbing")}><GripVertical className="h-4 w-4" /></button>} />
  </div>;
}

type ViewProps = { tasks: Task[]; onEditTask: (task: Task) => void; onAddTask: (status: string) => void };

function TaskColumn({ col, tasks, onAddTask, onEditTask }: ViewProps & { col: typeof COLUMNS[number] }) {
  const { locked } = useContext(BoardInteraction);
  const { setNodeRef, isOver } = useDroppable({ id: col.id, data: { type: "Column" }, disabled: locked });
  return <section aria-label={col.label} className="min-w-0">
    <div className="mb-4 flex h-9 items-center gap-2 px-1"><span className={cn("h-2 w-2 rounded-full", col.color)} /><h2 className="text-sm font-semibold">{col.label}</h2><span className="text-xs text-[#68717f]">{tasks.length}</span></div>
    <div ref={setNodeRef} className={cn("min-h-48 space-y-3 rounded-lg p-1 transition-colors", isOver && "bg-[#e2f2ec]/60")}>
      <SortableContext id={col.id} items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>{tasks.map(task => <SortableTask key={task.id} task={task} onEdit={() => onEditTask(task)} />)}</SortableContext>
      {tasks.length === 0 && <p className="py-6 text-center text-xs text-[#68717f]">No tasks</p>}
      <button type="button" disabled={locked} onClick={() => onAddTask(col.id)} className={cn(focusRing, "flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm text-[#68717f] transition-colors hover:bg-white hover:text-[#087f70] disabled:opacity-50")}><Plus className="h-4 w-4" />Add a task</button>
    </div>
  </section>;
}

function TaskRow({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const { locked } = useContext(BoardInteraction);
  return <button type="button" disabled={locked} onClick={onEdit} aria-label={`Edit ${task.title}`} className={cn(focusRing, "flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#e4e7eb] px-2 py-3 text-left transition-colors hover:bg-white disabled:opacity-60 sm:flex-nowrap")}>
    <span className="shrink-0"><TaskStatusIcon task={task} /></span>
    <span className="min-w-0 flex-1 basis-3/4 sm:basis-auto"><span className={cn("block text-sm font-medium [overflow-wrap:anywhere]", task.status === "completed" && "text-[#68717f] line-through")}>{task.title}</span>{task.description && <span className="mt-0.5 block line-clamp-1 text-xs text-[#68717f] [overflow-wrap:anywhere]">{task.description}</span>}</span>
    <PriorityBadge priority={task.priority} /><DueDateChip task={task} /><Pencil className="ml-auto h-3.5 w-3.5 shrink-0 text-[#9aa1ab]" />
  </button>;
}

function ListView({ tasks, onEditTask, onAddTask }: ViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { locked, reduced } = useContext(BoardInteraction);
  return <div className="space-y-6">{COLUMNS.map(col => {
    const items = tasks.filter(task => task.status === col.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    return <section key={col.id}>
      <div className="mb-1 flex items-center justify-between gap-2 border-b border-[#e4e7eb] py-2">
        <button type="button" aria-expanded={!collapsed[col.id]} aria-controls={`list-${col.id}`} onClick={() => setCollapsed(previous => ({ ...previous, [col.id]: !previous[col.id] }))} className={cn(focusRing, "flex min-w-0 items-center gap-2 rounded p-1 text-sm font-semibold")}><motion.span animate={{ rotate: collapsed[col.id] ? -90 : 0 }} transition={{ duration: reduced ? 0 : 0.16 }}><ChevronDown className="h-4 w-4 text-[#68717f]" /></motion.span><StatusBadge status={col.id} /><span className="text-xs font-normal text-[#68717f]">{items.length}</span></button>
        <button type="button" disabled={locked} aria-label={`Add task to ${col.label}`} title="Add task" onClick={() => onAddTask(col.id)} className={cn(focusRing, "rounded p-2 text-[#68717f] hover:bg-white hover:text-[#087f70]")}><Plus className="h-4 w-4" /></button>
      </div>
      <AnimatePresence initial={false}>{!collapsed[col.id] && <motion.div id={`list-${col.id}`} key={col.id} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.18, ease: easeOut }} className="overflow-hidden">{items.length ? items.map(task => <TaskRow key={task.id} task={task} onEdit={() => onEditTask(task)} />) : <p className="px-2 py-5 text-sm text-[#68717f]">No tasks</p>}</motion.div>}</AnimatePresence>
    </section>;
  })}</div>;
}

type SortKey = "title" | "status" | "dueDate" | "createdAt" | "priority";

function TableView({ tasks, onEditTask }: ViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { locked } = useContext(BoardInteraction);
  const sorted = useMemo(() => [...tasks].sort((a, b) => {
    let result: number;
    if (sortKey === "status") result = COLUMNS.findIndex(col => col.id === a.status) - COLUMNS.findIndex(col => col.id === b.status);
    else if (sortKey === "priority") result = ["low", "medium", "high"].indexOf(a.priority) - ["low", "medium", "high"].indexOf(b.priority);
    else result = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
    return (sortDir === "asc" ? result : -result) || a.position - b.position || a.id.localeCompare(b.id);
  }), [tasks, sortKey, sortDir]);
  const headers: { key: SortKey; label: string }[] = [{ key: "title", label: "Title" }, { key: "status", label: "Status" }, { key: "priority", label: "Priority" }, { key: "dueDate", label: "Due date" }, { key: "createdAt", label: "Created" }];
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left">
    <caption className="sr-only">Workspace tasks</caption>
    <thead><tr>{headers.map(header => {
      const selected = sortKey === header.key;
      const Icon = selected ? sortDir === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
      return <th key={header.key} scope="col" aria-sort={selected ? sortDir === "asc" ? "ascending" : "descending" : "none"} className="border-b border-[#e4e7eb] px-3 py-3 text-xs font-medium text-[#68717f]"><button type="button" onClick={() => { if (selected) setSortDir(value => value === "asc" ? "desc" : "asc"); else { setSortKey(header.key); setSortDir("asc"); } }} className={cn(focusRing, "flex items-center gap-2 rounded hover:text-[#087f70]")}>{header.label}<Icon className="h-3 w-3" /></button></th>;
    })}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{sorted.map(task => <tr key={task.id} className="border-b border-[#e4e7eb] transition-colors hover:bg-white">
      <td className="w-[34%] min-w-48 px-3 py-4"><button type="button" disabled={locked} onClick={() => onEditTask(task)} aria-label={`Edit ${task.title}`} className={cn(focusRing, "flex w-full items-start gap-2 rounded text-left hover:text-[#087f70]")}><span className="mt-0.5 shrink-0"><TaskStatusIcon task={task} /></span><span className="min-w-0"><span className={cn("block text-sm font-medium [overflow-wrap:anywhere]", task.status === "completed" && "text-[#68717f] line-through")}>{task.title}</span>{task.description && <span className="mt-1 block line-clamp-1 text-xs text-[#68717f] [overflow-wrap:anywhere]">{task.description}</span>}</span></button></td>
      <td className="px-3 py-4"><StatusBadge status={task.status} /></td><td className="px-3 py-4"><PriorityBadge priority={task.priority} /></td>
      <td className="px-3 py-4">{task.dueDate ? <DueDateChip task={task} year /> : <span className="text-xs text-[#68717f]">No date</span>}</td>
      <td className="whitespace-nowrap px-3 py-4 text-xs text-[#68717f]">{new Date(task.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</td>
      <td className="px-3 py-4"><button type="button" disabled={locked} aria-label={`Edit ${task.title}`} title="Edit task" onClick={() => onEditTask(task)} className={cn(focusRing, "rounded p-2 text-[#68717f] hover:bg-[#e2f2ec] hover:text-[#087f70]")}><Pencil className="h-3.5 w-3.5" /></button></td>
    </tr>)}{sorted.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-[#68717f]">No tasks</td></tr>}</tbody>
  </table></div>;
}

// Calendar ordinals avoid daylight-saving offsets when positioning date-only tasks.
function calendarDay(date: Date): number { return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000; }

function TimelineView({ tasks, onEditTask }: ViewProps) {
  const now = useContext(BoardTime);
  const { locked, reduced } = useContext(BoardInteraction);
  const dated = tasks.filter(task => task.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.id.localeCompare(b.id));
  const undated = tasks.filter(task => !task.dueDate);
  const today = calendarDay(now);
  const dates = dated.map(task => calendarDay(dueDateLocal(task.dueDate!)));
  const start = dates.length ? Math.min(...dates) - 4 : today - 2;
  const end = Math.max(start + 30, dates.length ? Math.max(...dates) + 4 : today + 28);
  const percent = (day: number) => (day - start) / (end - start) * 100;
  const ticks = Array.from({ length: 9 }, (_, index) => start + Math.round(index * (end - start) / 8));
  const todayPct = percent(today);
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-x-5 gap-y-2">{COLUMNS.map(col => <StatusBadge key={col.id} status={col.id} />)}</div>
    <div className="overflow-x-auto"><div className="min-w-[760px]">
      <div className="flex h-12 items-center border-b border-[#e4e7eb]"><span className="w-52 shrink-0 px-2 text-xs text-[#68717f]">Task</span><div className="relative mr-14 h-full flex-1">{ticks.map((day, index) => <span key={day} className="absolute top-4 whitespace-nowrap text-[10px] text-[#68717f]" style={{ left: `${percent(day)}%`, transform: index === ticks.length - 1 ? "translateX(-100%)" : undefined }}>{new Date(day * 86400000).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric" })}</span>)}</div></div>
      {dated.map(task => {
        const pct = percent(calendarDay(dueDateLocal(task.dueDate!)));
        const col = COLUMNS.find(column => column.id === task.status) ?? COLUMNS[0];
        const overdue = isTaskOverdue(task.dueDate, task.status, now);
        return <div key={task.id} className="flex min-h-16 border-b border-[#e4e7eb] hover:bg-white">
          <button type="button" disabled={locked} onClick={() => onEditTask(task)} aria-label={`Edit ${task.title}`} className={cn(focusRing, "flex w-52 shrink-0 items-center gap-2 rounded px-2 py-3 text-left text-sm hover:text-[#087f70]")}><span className="shrink-0"><TaskStatusIcon task={task} /></span><span className="min-w-0 [overflow-wrap:anywhere]">{task.title}</span></button>
          <div className="relative mr-14 flex-1">{ticks.map(day => <span key={day} className="pointer-events-none absolute inset-y-0 w-px bg-[#e4e7eb]/60" style={{ left: `${percent(day)}%` }} />)}{todayPct >= 0 && todayPct <= 100 && <span title="Today" className="pointer-events-none absolute inset-y-0 w-px bg-[#087f70]/40" style={{ left: `${todayPct}%` }} />}
            <motion.button type="button" disabled={locked} aria-label={`Edit ${task.title}, due ${dueDateLocal(task.dueDate!).toLocaleDateString()}`} title={`${task.title} - ${dueDateLocal(task.dueDate!).toLocaleDateString()}`} onClick={() => onEditTask(task)} whileHover={reduced || locked ? undefined : { scale: 1.2 }} className={cn(focusRing, "absolute top-1/2 -mt-2 h-4 w-4 rounded-full border-2 border-white shadow-sm", overdue ? "bg-[#d66b55]" : col.color)} style={{ left: `calc(${pct}% - 8px)` }} />
            <span className={cn("pointer-events-none absolute top-1/2 -mt-2 whitespace-nowrap text-xs", overdue ? "text-[#b6513e]" : "text-[#68717f]")} style={pct > 75 ? { right: `calc(${100 - pct}% + 14px)` } : { left: `calc(${pct}% + 14px)` }}>{dueDateLocal(task.dueDate!).toLocaleDateString(undefined, { day: "numeric", month: "short" })}{overdue && " · Overdue"}</span>
          </div>
        </div>;
      })}
      {dated.length === 0 && <p className="py-12 text-center text-sm text-[#68717f]">No due dates set</p>}
    </div></div>
    {undated.length > 0 && <section><h2 className="mb-2 text-xs font-medium text-[#68717f]">Without due dates ({undated.length})</h2>{undated.map(task => <TaskRow key={task.id} task={task} onEdit={() => onEditTask(task)} />)}</section>}
  </div>;
}

interface TasksPageProps { workspaceId?: string; }

export default function TaskBoard({ workspaceId }: TasksPageProps) {
  const { workspaces } = useWorkspaces();
  const token = getToken();
  const router = useRouter();
  const reduced = !!useReducedMotion();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState("Board");
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const orderPending = useRef(false);
  const [reload, setReload] = useState(0);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState("todo");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const displayedWorkspaceName = workspaces.find(workspace => workspace.id === workspaceId)?.name ?? workspaceName;
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const newTaskButton = useRef<HTMLButtonElement | null>(null);
  const renameButton = useRef<HTMLButtonElement | null>(null);
  const locked = savingOrder || workspaceBusy || showCreate || !!editingTask || showDeleteDialog || isRenaming;
  const toolbarLocked = savingOrder || workspaceBusy || !!activeTask;
  const filtering = !!query.trim() || priorityFilter !== "all";
  // Filtering never replaces authoritative tasks: hidden tasks retain their persisted order.
  const visibleTasks = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return tasks.filter(task => (priorityFilter === "all" || task.priority === priorityFilter) && (!search || `${task.title}\n${task.description ?? ""}`.toLocaleLowerCase().includes(search)));
  }, [tasks, query, priorityFilter]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, scrollBehavior: reduced ? "auto" : "smooth" }));

  useEffect(() => {
    if (!token || !workspaceId) return;
    const controller = new AbortController();
    Promise.all([
      api<Task[]>(`/api/tasks?workspaceId=${encodeURIComponent(workspaceId)}`, { token, signal: controller.signal }),
      api<{ name: string }>(`/api/workspaces/${workspaceId}`, { token, signal: controller.signal }),
    ]).then(([data, workspace]) => {
      if (controller.signal.aborted) return;
      setTasks(data); setWorkspaceName(workspace.name); setNewName(workspace.name);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load workspace.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, workspaceId, reload]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (orderPending.current || locked) return;
    setActiveTask(tasks.find(task => task.id === active.id) ?? null);
  };
  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    if (!over || !token || orderPending.current || locked) return;
    const previous = tasks;
    const next = moveTask(tasks, String(active.id), String(over.id));
    if (next === tasks) return;
    orderPending.current = true; setSavingOrder(true); setError(""); setTasks(next);
    try {
      const saved = await api<Task[]>(`/api/tasks/${active.id}/move`, { method: "PUT", token, body: { overId: String(over.id) } });
      setTasks(saved);
    } catch (error) {
      setTasks(previous); setError(error instanceof Error ? error.message : "Unable to save task order.");
    } finally { orderPending.current = false; setSavingOrder(false); }
  };
  const handleCreateTask = async (data: Partial<Task>) => {
    if (!token || !workspaceId) return;
    const created = await api<Task>("/api/tasks", { method: "POST", token, body: { ...data, workspaceId } });
    setTasks(previous => [created, ...previous]);
  };
  const handleUpdateTask = async (updated: Partial<Task>) => {
    if (!token || !editingTask) return;
    const saved = await api<Task>(`/api/tasks/${editingTask.id}`, { method: "PUT", token, body: updated });
    setTasks(previous => previous.map(task => task.id === saved.id ? saved : task));
  };
  const handleDeleteTask = async () => {
    if (!token || !editingTask) return;
    await api(`/api/tasks/${editingTask.id}`, { method: "DELETE", token });
    setTasks(previous => previous.filter(task => task.id !== editingTask.id));
  };
  const finishRename = () => { setIsRenaming(false); requestAnimationFrame(() => renameButton.current?.focus()); };
  const handleRename = async () => {
    if (!token || !workspaceId || !newName.trim() || workspaceBusy) return;
    setWorkspaceBusy(true); setError("");
    try {
      await api(`/api/workspaces/${workspaceId}`, { method: "PUT", token, body: { name: newName.trim() } });
      setWorkspaceName(newName.trim()); finishRename(); window.dispatchEvent(new Event("workspace-updated"));
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to rename workspace."); }
    finally { setWorkspaceBusy(false); }
  };
  const handleDeleteWorkspace = async () => {
    if (!token || !workspaceId || workspaceBusy || orderPending.current) return;
    setWorkspaceBusy(true); setError("");
    try {
      await api(`/api/workspaces/${workspaceId}`, { method: "DELETE", token });
      window.dispatchEvent(new Event("workspace-updated")); router.push("/workspaces");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to delete workspace."); setShowDeleteDialog(false); }
    finally { setWorkspaceBusy(false); }
  };
  const captureFocus = () => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; };
  const restoreFocus = () => {
    const target = returnFocus.current;
    if (target?.isConnected && !target.matches(":disabled")) target.focus(); else newTaskButton.current?.focus();
  };
  const openCreate = (status: string) => { if (orderPending.current || activeTask || locked) return; captureFocus(); setNewTaskStatus(status); setShowCreate(true); };
  const openEdit = (task: Task) => { if (orderPending.current || activeTask || locked) return; captureFocus(); setEditingTask(task); };
  const getTasksForColumn = (colId: string) => visibleTasks.filter(task => task.status === colId).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const dropAnimation: DropAnimation = { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) };
  if (!workspaceId) return <div className="p-8 text-[#68717f]">Please select a workspace.</div>;

  return <BoardTime.Provider value={now}><BoardInteraction.Provider value={{ locked, reduced }}><DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveTask(null)}>
    <div className="min-h-full min-w-0 bg-[#f5f6f8] px-4 py-5 text-[#171b22] sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-7 flex min-w-0 items-start gap-2 text-xs text-[#68717f]"><Link href="/workspaces" className={cn(focusRing, "shrink-0 rounded hover:text-[#087f70]")}>Workspaces</Link><ChevronRight className="mt-0.5 h-3 w-3 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{displayedWorkspaceName || "Workspace"}</span></nav>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-full flex-1">
          {isRenaming ? <form onSubmit={event => { event.preventDefault(); void handleRename(); }} className="flex flex-wrap items-center gap-2" aria-busy={workspaceBusy}>
            <Input aria-label="Workspace name" value={newName} onChange={event => setNewName(event.target.value)} maxLength={255} autoFocus disabled={workspaceBusy} onKeyDown={event => { if (event.key === "Escape" && !workspaceBusy) finishRename(); }} className={cn(fieldClass, "h-10 min-w-0 flex-1 basis-48 text-lg font-semibold")} />
            <Button type="submit" disabled={workspaceBusy || !newName.trim()} size="sm" className={actionClass}>Save</Button><Button type="button" disabled={workspaceBusy} onClick={finishRename} size="sm" variant="ghost">Cancel</Button>
          </form> : <div className="flex min-w-0 items-start gap-2"><h1 className="min-w-0 text-[28px] font-semibold leading-9 [overflow-wrap:anywhere]">{displayedWorkspaceName || "Workspace"}</h1><button ref={renameButton} type="button" aria-label="Rename workspace" title="Rename workspace" disabled={toolbarLocked || loading || locked} onClick={() => { setNewName(displayedWorkspaceName); setIsRenaming(true); }} className={cn(focusRing, "mt-1.5 shrink-0 rounded p-1.5 text-[#68717f] hover:bg-white hover:text-[#087f70] disabled:opacity-40")}><Pencil className="h-4 w-4" /></button></div>}
          <p className="mt-2 text-sm text-[#68717f]">{loading ? "Loading tasks..." : `${tasks.length} task${tasks.length === 1 ? "" : "s"} · ${tasks.filter(task => task.status === "completed").length} completed`}</p>
        </div>
        <Dialog open={showDeleteDialog} onOpenChange={value => !workspaceBusy && setShowDeleteDialog(value)}><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Delete workspace" title="Delete workspace" disabled={toolbarLocked || loading || isRenaming} className="rounded-md text-[#68717f] hover:bg-[#fbe8e4] hover:text-[#a84432]"><Trash2 className="h-4 w-4" /></Button></DialogTrigger>
          <DialogContent aria-describedby="delete-workspace-description" className={cn(dialogClass, "sm:max-w-sm")} showCloseButton={false}><DialogHeader><DialogTitle className="break-words leading-6">Delete &quot;{displayedWorkspaceName}&quot;?</DialogTitle></DialogHeader><p id="delete-workspace-description" className="text-sm leading-6 text-[#68717f]">This permanently deletes the workspace and all its tasks. This action cannot be undone.</p><div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={workspaceBusy} onClick={() => setShowDeleteDialog(false)}>Cancel</Button><Button variant="destructive" disabled={workspaceBusy || savingOrder} onClick={handleDeleteWorkspace}>{workspaceBusy && <Loader2 className="h-4 w-4 animate-spin" />}Delete forever</Button></div></DialogContent>
        </Dialog>
      </header>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-5 gap-y-3 border-b border-[#e4e7eb]">
        <div role="group" aria-label="Task view" className="flex max-w-full flex-wrap gap-1">{VIEW_MODES.map(({ id, icon: Icon }) => <button key={id} type="button" aria-pressed={viewMode === id} disabled={toolbarLocked} onClick={() => setViewMode(id)} className={cn(focusRing, "relative flex h-11 items-center gap-1.5 px-2.5 text-sm transition-colors sm:px-3", viewMode === id ? "font-semibold text-[#087f70]" : "text-[#68717f] hover:text-[#171b22]")}><Icon className="h-3.5 w-3.5 shrink-0" />{id}{viewMode === id && <motion.span layoutId={`board-view-${workspaceId}`} transition={{ duration: reduced ? 0 : 0.2, ease: easeOut }} className="absolute inset-x-0 bottom-0 h-0.5 bg-[#087f70]" />}</button>)}</div>
        <div className="mb-2 flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
          <div className="relative min-w-0 flex-1 basis-44 sm:w-56 sm:flex-none"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#68717f]" /><Input type="search" aria-label="Search tasks" placeholder="Search tasks..." value={query} disabled={toolbarLocked || loading} onChange={event => setQuery(event.target.value)} className={cn(fieldClass, "h-10 bg-white pl-9")} /></div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter} disabled={toolbarLocked || loading}><SelectTrigger aria-label="Filter by priority" className={cn(fieldClass, "h-10 w-44 shrink-0 bg-white")}><SlidersHorizontal className="h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All priorities</SelectItem>{Object.entries(PRIORITY_META).map(([value, meta]) => <SelectItem key={value} value={value}>{meta.label}</SelectItem>)}</SelectContent></Select>
          <Button ref={newTaskButton} disabled={toolbarLocked || loading || locked} onClick={() => openCreate("todo")} className={cn(actionClass, "h-10")}><Plus className="h-4 w-4" />New task</Button>
        </div>
      </div>
      <AnimatePresence initial={false}>{error && <motion.div key="board-error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.15 }} className="mb-4 flex flex-wrap items-center gap-2 rounded-md bg-[#fbe8e4] p-3 text-sm text-[#a84432]"><span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{error}</span><button type="button" disabled={toolbarLocked || locked} onClick={() => { setLoading(true); setError(""); setReload(value => value + 1); }} className={cn(focusRing, "rounded underline underline-offset-2")}>Retry</button></motion.div>}</AnimatePresence>
      <div role="status" aria-live="polite" className="mb-3 min-h-5 text-xs text-[#68717f]">{savingOrder ? "Saving task order..." : filtering ? `${visibleTasks.length} of ${tasks.length} tasks` : ""}</div>
      {filtering && <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[#68717f]">{visibleTasks.length === 0 && <span>No matching tasks</span>}<button type="button" disabled={toolbarLocked} onClick={() => { setQuery(""); setPriorityFilter("all"); }} className={cn(focusRing, "inline-flex items-center gap-1 rounded text-[#087f70] hover:underline")}><X className="h-3 w-3" />Clear filters</button></div>}
      {loading ? <div role="status" className="flex items-center justify-center gap-2 py-24 text-sm text-[#68717f]"><Loader2 className="h-5 w-5 animate-spin text-[#087f70]" />Loading tasks...</div> : <AnimatePresence initial={false} mode="wait"><motion.div key={viewMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.12 }}>
        {viewMode === "Board" && <div className="overflow-x-auto pb-4"><div className="grid grid-cols-4 items-start gap-4" style={{ minWidth: 1056 }}>{COLUMNS.map(col => <TaskColumn key={col.id} col={col} tasks={getTasksForColumn(col.id)} onAddTask={openCreate} onEditTask={openEdit} />)}</div></div>}
        {viewMode === "List" && <ListView tasks={visibleTasks} onEditTask={openEdit} onAddTask={openCreate} />}
        {viewMode === "Table" && <TableView tasks={visibleTasks} onEditTask={openEdit} onAddTask={openCreate} />}
        {viewMode === "Timeline" && <TimelineView tasks={visibleTasks} onEditTask={openEdit} onAddTask={openCreate} />}
      </motion.div></AnimatePresence>}
      <DragOverlay dropAnimation={reduced ? null : dropAnimation}>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay>
    </div>
    {showCreate && <TaskDialog initialStatus={newTaskStatus} onClose={() => setShowCreate(false)} restoreFocus={restoreFocus} onSave={handleCreateTask} />}
    {editingTask && <TaskDialog key={editingTask.id} task={editingTask} onClose={() => setEditingTask(null)} restoreFocus={restoreFocus} onSave={handleUpdateTask} onDelete={handleDeleteTask} />}
  </DndContext></BoardInteraction.Provider></BoardTime.Provider>;
}
