"use client";

import { useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import { api, getToken, type Task } from "@/lib/api";
import { useWorkspaces } from "@/lib/contexts/WorkspacesContext";
import { moveTask, dueDateLocal, isTaskOverdue } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MoreHorizontal,
  Plus,
  Flag,
  Loader2,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  LayoutGrid,
  List,
  Table2,
  CalendarDays,
  ArrowUpDown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// DnD Kit
import {
  DndContext,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  DragStartEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Constants ────────────────────────────────────────────────────────────────

const BoardTime = createContext(new Date(0));

const VIEW_MODES = [
  { id: "Board", icon: LayoutGrid },
  { id: "List",  icon: List },
  { id: "Table", icon: Table2 },
  { id: "Timeline", icon: CalendarDays },
];

const COLUMNS = [
  { id: "todo",        label: "To Do",       color: "bg-blue-500",    textColor: "text-blue-600",   ring: "ring-blue-200"    },
  { id: "in-progress", label: "In Progress", color: "bg-amber-400",   textColor: "text-amber-600",  ring: "ring-amber-200"   },
  { id: "in-review",   label: "In Review",   color: "bg-violet-500",  textColor: "text-violet-600", ring: "ring-violet-200"  },
  { id: "completed",   label: "Completed",   color: "bg-emerald-500", textColor: "text-emerald-600",ring: "ring-emerald-200" },
];

const STATUS_META: Record<string, { label: string; color: string; dot: string; border: string }> = {
  "todo":        { label: "To Do",        color: "text-blue-600 bg-blue-50",      dot: "bg-blue-500",    border: "border-blue-100"   },
  "in-progress": { label: "In Progress",  color: "text-amber-600 bg-amber-50",    dot: "bg-amber-400",   border: "border-amber-100"  },
  "in-review":   { label: "In Review",    color: "text-violet-600 bg-violet-50",  dot: "bg-violet-500",  border: "border-violet-100" },
  "completed":   { label: "Completed",    color: "text-emerald-600 bg-emerald-50",dot: "bg-emerald-500", border: "border-emerald-100" },
};

const PRIORITY_META: Record<string, { label: string; color: string; dot: string }> = {
  "high":   { label: "High",   color: "text-red-700 bg-red-50 border-red-100",     dot: "bg-red-500" },
  "medium": { label: "Medium", color: "text-amber-700 bg-amber-50 border-amber-100", dot: "bg-amber-400" },
  "low":    { label: "Low",    color: "text-blue-700 bg-blue-50 border-blue-100",   dot: "bg-blue-400" },
};

const AVATARS = ["https://i.pravatar.cc/150?u=1", "https://i.pravatar.cc/150?u=2"];

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Dynamic icon based on status + deadline proximity */
function TaskStatusIcon({ status, dueDate }: { status: string; dueDate?: string | null }) {
  const now = useContext(BoardTime);
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "todo") return <Circle className="h-3.5 w-3.5 text-gray-400" />;
  // in-progress or in-review → Clock
  const isUrgent = dueDate && (dueDateLocal(dueDate).getTime() - now.getTime()) <= 24 * 60 * 60 * 1000 && !isTaskOverdue(dueDate, status, now);
  return <Clock className={cn("h-3.5 w-3.5", isUrgent ? "text-amber-500" : "text-gray-400")} />;
}

/** Red pill shown next to due dates on overdue tasks */
function OverduePill({ dueDate, status }: { dueDate?: string | null; status: string }) {
  const now = useContext(BoardTime);
  if (!dueDate || status === "completed") return null;
  if (!isTaskOverdue(dueDate, status, now)) return null;
  return <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full leading-none whitespace-nowrap">OVERDUE</span>;
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META["todo"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap", m.color)}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", m.dot)} />
      {m.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority] ?? PRIORITY_META["medium"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", m.color)}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", m.dot)} />
      {m.label}
    </span>
  );
}

function DueDateChip({ dueDate, status }: { dueDate?: string | null; status: string }) {
  const now = useContext(BoardTime);
  if (!dueDate) return null;
  const overdue = isTaskOverdue(dueDate, status, now);
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("flex items-center gap-1 text-xs font-medium", overdue ? "text-red-500" : "text-gray-400")}>
        <Flag className="h-3 w-3" />
        {dueDateLocal(dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
      </span>
      <OverduePill dueDate={dueDate} status={status} />
    </span>
  );
}

// ─── Edit Task Dialog ─────────────────────────────────────────────────────────

interface EditTaskDialogProps {
  task: Task;
  open: boolean;
  onClose: () => void;
  onSave: (updated: Partial<Task>) => Promise<void>;
  onDelete: () => Promise<void>;
}

function EditTaskDialog({ task, open, onClose, onSave, onDelete }: EditTaskDialogProps) {
  const [title, setTitle]     = useState(task.title);
  const [desc, setDesc]       = useState(task.description ?? "");
  const [status, setStatus]   = useState(task.status);
  const [priority, setPriority] = useState<Task["priority"]>(task.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split("T")[0] : "");
  const [saving, setSaving]   = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const colDef = COLUMNS.find(c => c.id === status);

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ title: title.trim(), description: desc, status, priority, dueDate: dueDate || null });
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save task."); }
    finally { setSaving(false); }
  };
  const handleDelete = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try { await onDelete(); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to delete task."); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && !saving && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-lg p-0 overflow-hidden rounded-2xl border border-gray-100 shadow-2xl" showCloseButton={false}>
        <div className={cn("h-1.5 w-full", colDef?.color ?? "bg-blue-500")} />
        <DialogHeader className="sr-only"><DialogTitle>Edit Task</DialogTitle></DialogHeader>
        <div className="px-6 pt-5 pb-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <StatusBadge status={status} />
            <button aria-label="Close task editor" disabled={saving} onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-1.5">
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Label htmlFor="edit-task-title" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</Label>
            <Input id="edit-task-title" value={title} onChange={e => setTitle(e.target.value)} className="text-base font-semibold rounded-xl" autoFocus onKeyDown={e => e.key === "Enter" && handleSave()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-description" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</Label>
            <Textarea id="edit-task-description" value={desc} onChange={e => setDesc(e.target.value)} className="resize-none rounded-xl min-h-[80px] text-sm" placeholder="Add more details…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-task-status" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as Task["status"])}>
                <SelectTrigger id="edit-task-status" className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-task-priority" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as Task["priority"])}>
                <SelectTrigger id="edit-task-priority" className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-due-date" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</Label>
            <Input id="edit-task-due-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-xl" />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            {confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600 font-medium">Delete this task?</span>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={saving} className="rounded-lg">Yes, Delete</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} className="rounded-lg">Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg gap-1.5">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={!title.trim() || saving} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Task Dialog ───────────────────────────────────────────────────────

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  initialStatus: string;
  onCreate: (data: { title: string; description: string; status: string; priority: string; dueDate?: string }) => Promise<void>;
}

function CreateTaskDialog({ open, onClose, initialStatus, onCreate }: CreateTaskDialogProps) {
  const [title, setTitle]   = useState("");
  const [desc, setDesc]     = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");


  const handleCreate = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try { await onCreate({ title: title.trim(), description: desc, status, priority, dueDate: dueDate || undefined }); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to create task."); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && !saving && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-md p-0 overflow-hidden rounded-2xl border border-gray-100 shadow-2xl" showCloseButton={false}>
        <div className={cn("h-1.5 w-full", COLUMNS.find(c => c.id === status)?.color ?? "bg-blue-500")} />
        <div className="px-6 pt-5 pb-6 space-y-4">
          <DialogHeader><DialogTitle className="text-lg font-bold text-gray-900">New Task</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Label htmlFor="create-task-title" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</Label>
            <Input id="create-task-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" className="rounded-xl" autoFocus onKeyDown={e => e.key === "Enter" && handleCreate()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-task-description" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description <span className="text-gray-300 normal-case font-normal">(optional)</span></Label>
            <Textarea id="create-task-description" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Add more detail…" className="resize-none rounded-xl min-h-[72px] text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-task-status" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Column</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="create-task-status" className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-task-priority" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="create-task-priority" className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-task-due-date" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date <span className="text-gray-300 normal-case font-normal">(opt.)</span></Label>
            <Input id="create-task-due-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded-xl" />
          </div>
          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <Button disabled={saving} variant="ghost" onClick={onClose} className="rounded-xl text-gray-500">Cancel</Button>
            <Button onClick={handleCreate} disabled={!title.trim() || saving} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Board view components ────────────────────────────────────────────────────

function TaskCard({ task, onEdit }: { task: Task; onEdit?: () => void }) {
    return (
    <div className="group/card bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 hover:ring-1 hover:ring-blue-100 transition-all duration-150 cursor-grab active:cursor-grabbing space-y-3">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <div className="flex-1" />
        <button aria-label={`Edit ${task.title}`}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onEdit?.(); }}
          className="opacity-0 group-hover/card:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div>
        <h3 className="text-gray-900 font-semibold text-sm leading-snug mb-1 line-clamp-2">{task.title}</h3>
        {task.description && <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">{task.description}</p>}
      </div>
      <div className="flex items-center justify-between">
        <DueDateChip dueDate={task.dueDate} status={task.status} />
        <div className="flex -space-x-2">
          {AVATARS.map((src, i) => (
            <Avatar key={i} className="h-6 w-6 border-2 border-white">
              <AvatarImage src={src} /><AvatarFallback className="text-[9px]">U{i}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>
    </div>
  );
}

function SortableTask({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { task } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }} {...attributes} {...listeners}>
      <TaskCard task={task} onEdit={onEdit} />
    </div>
  );
}

function TaskColumn({ col, tasks, onAddTask, onEditTask }: { col: typeof COLUMNS[0]; tasks: Task[]; onAddTask: (s: string) => void; onEditTask: (t: Task) => void }) {
  const { setNodeRef } = useDroppable({ id: col.id, data: { type: "Column" } });
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", col.color)} />
          <h3 className="font-semibold text-gray-700 text-sm">{col.label}</h3>
          <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full h-5 min-w-[20px] flex items-center justify-center px-1.5">{tasks.length}</span>
        </div>
        <button aria-label={`Add task to ${col.label}`} onClick={() => onAddTask(col.id)} className="h-7 w-7 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div ref={setNodeRef} className="flex-1 flex flex-col gap-3 min-h-[140px] p-2 rounded-2xl border-2 border-dashed border-transparent bg-gray-50/40 hover:border-gray-200 hover:bg-gray-50 transition-all">
        <SortableContext id={col.id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => <SortableTask key={task.id} task={task} onEdit={() => onEditTask(task)} />)}
        </SortableContext>
        {tasks.length === 0 && <div className="flex-1 flex items-center justify-center text-gray-300 text-xs font-medium select-none">Drop here</div>}
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ tasks, onEditTask, onAddTask }: { tasks: Task[]; onEditTask: (t: Task) => void; onAddTask: (s: string) => void }) {
  const now = useContext(BoardTime);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setCollapsed(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="space-y-3">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
        const isCollapsed = collapsed[col.id];
        return (
          <div key={col.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Group header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => toggle(col.id)}
            >
              <div className="flex items-center gap-3">
                <span className={cn("h-3 w-3 rounded-full", col.color)} />
                <span className="font-semibold text-gray-800 text-sm">{col.label}</span>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{colTasks.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button aria-label={`Add task to ${col.label}`}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onAddTask(col.id); }}
                  className="h-7 w-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
            </div>

            {/* Task rows */}
            {!isCollapsed && (
              <div className="divide-y divide-gray-50">
                {colTasks.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400 italic">No tasks here yet.</div>
                ) : (
                  colTasks.map(task => {
                    const isOverdue = isTaskOverdue(task.dueDate, task.status, now);
                    return (
                      <div
                        key={task.id}
                        className="group flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50/40 transition-colors cursor-pointer"
                        onClick={() => onEditTask(task)}
                      >
                        {/* Status icon */}
                        <div className="shrink-0"><TaskStatusIcon status={task.status} dueDate={task.dueDate} /></div>

                        {/* Title + desc */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{task.title}</p>
                          {task.description && <p className="text-xs text-gray-400 truncate">{task.description}</p>}
                        </div>

                        {/* Due date */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          {task.dueDate ? (
                            <span className={cn("text-xs font-medium", isOverdue ? "text-red-500" : "text-gray-400")}>
                              {dueDateLocal(task.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                            </span>
                          ) : <span className="text-xs text-gray-300">—</span>}
                          <OverduePill dueDate={task.dueDate} status={task.status} />
                        </div>

                        {/* Avatars */}
                        <div className="shrink-0 flex -space-x-1.5">
                          {AVATARS.map((src, i) => (
                            <Avatar key={i} className="h-6 w-6 border-2 border-white">
                              <AvatarImage src={src} /><AvatarFallback className="text-[9px]">U</AvatarFallback>
                            </Avatar>
                          ))}
                        </div>

                        <MoreHorizontal className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Table View ───────────────────────────────────────────────────────────────

type SortKey = "title" | "status" | "dueDate" | "createdAt" | "priority";

function SortHeader({ label, col, sortKey, onSort }: { label: string; col: SortKey; sortKey: SortKey; onSort: (col: SortKey) => void }) { return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn("h-3 w-3", sortKey === col ? "text-blue-500" : "text-gray-300")} />
      </div>
    </th>
  );
}

function TableView({ tasks, onEditTask }: { tasks: Task[]; onEditTask: (t: Task) => void; onAddTask: (s: string) => void }) {
  const now = useContext(BoardTime);
  const [sortKey, setSortKey]   = useState<SortKey>("status");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let av: string = a[sortKey] ?? "";
      let bv: string = b[sortKey] ?? "";

      if (sortKey === "status") {
        const order = ["todo", "in-progress", "in-review", "completed"];
        av = String(order.indexOf(a.status));
        bv = String(order.indexOf(b.status));
      } else if (sortKey === "priority") {
         const order = ["low", "medium", "high"];
         av = String(order.indexOf(a.priority));
         bv = String(order.indexOf(b.priority));
      }

      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [tasks, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };


  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Action bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-gray-50/70 border-b border-gray-100">
            <tr>
              <SortHeader sortKey={sortKey} onSort={handleSort} label="Title"    col="title" />
              <SortHeader sortKey={sortKey} onSort={handleSort} label="Status"   col="status" />
              <SortHeader sortKey={sortKey} onSort={handleSort} label="Priority" col="priority" />
              <SortHeader sortKey={sortKey} onSort={handleSort} label="Due Date" col="dueDate" />
              <SortHeader sortKey={sortKey} onSort={handleSort} label="Created"  col="createdAt" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">No tasks yet. Create one to get started.</td></tr>
            ) : (
              sorted.map(task => {
                const isOverdue = isTaskOverdue(task.dueDate, task.status, now);
                return (
                  <tr
                    key={task.id}
                    className="group hover:bg-blue-50/30 transition-colors cursor-pointer"
                    onClick={() => onEditTask(task)}
                  >
                    {/* Title */}
                    <td className="px-4 py-3.5 max-w-[280px]">
                      <div className="flex items-center gap-2">
                        <div className="shrink-0"><TaskStatusIcon status={task.status} dueDate={task.dueDate} /></div>
                        <div className="min-w-0">
                          <p className={cn("font-medium text-sm text-gray-800 truncate", task.status === "completed" && "line-through text-gray-400")}>{task.title}</p>
                          {task.description && <p className="text-xs text-gray-400 truncate">{task.description}</p>}
                        </div>
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    {/* Due date */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {task.dueDate ? (
                          <span className={cn("text-sm font-medium flex items-center gap-1", isOverdue ? "text-red-500" : "text-gray-600")}>
                            {isOverdue && <AlertCircle className="h-3.5 w-3.5" />}
                            {dueDateLocal(task.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        ) : <span className="text-gray-300 text-sm">—</span>}
                        <OverduePill dueDate={task.dueDate} status={task.status} />
                      </div>
                    </td>
                    {/* Created */}
                    <td className="px-4 py-3.5 text-sm text-gray-400 whitespace-nowrap">
                      {new Date(task.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <MoreHorizontal className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Timeline View ────────────────────────────────────────────────────────────

function TimelineView({ tasks, onEditTask }: { tasks: Task[]; onEditTask: (t: Task) => void; onAddTask: (s: string) => void }) {
  const now = useContext(BoardTime);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Figure out date range: earliest dueDate to latest dueDate, with a minimum window of 30 days
  const datedTasks = tasks.filter(t => t.dueDate);
  const undatedTasks = tasks.filter(t => !t.dueDate);

  const getRange = () => {
    if (datedTasks.length === 0) {
      const start = new Date(today); start.setDate(start.getDate() - 2);
      const end   = new Date(today); end.setDate(end.getDate() + 28);
      return { start, end };
    }
    const dates = datedTasks.map(t => dueDateLocal(t.dueDate!));
    const minD = new Date(Math.min(...dates.map(d => d.getTime())));
    let maxD = new Date(Math.max(...dates.map(d => d.getTime())));
    minD.setDate(minD.getDate() - 4);
    if (maxD.getTime() - minD.getTime() < 29 * 86400000) maxD = new Date(minD.getTime() + 30 * 86400000);
    return { start: minD, end: maxD };
  };

  const { start, end } = getRange();
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;

  // Build day labels
  const days: Date[] = Array.from({ length: Math.min(totalDays, 21) }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + Math.floor(i * (totalDays - 1) / Math.max(1, Math.min(totalDays, 21) - 1))); return d;
  });

  const dayPct = (date: Date) => {
    const diff = date.getTime() - start.getTime();
    return (diff / (end.getTime() - start.getTime())) * 100;
  };

  const todayPct = dayPct(today);

  const colColor = (status: string) => COLUMNS.find(c => c.id === status)?.color ?? "bg-gray-400";
  const colTextColor = (status: string) => COLUMNS.find(c => c.id === status)?.textColor ?? "text-gray-600";

  // Month labels
  const monthLabels: { label: string; pct: number }[] = [];
  let lastMonth = -1;
  days.forEach(d => {
    if (d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth();
      monthLabels.push({ label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }), pct: dayPct(d) });
    }
  });

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        {COLUMNS.map(col => (
          <span key={col.id} className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <span className={cn("h-2.5 w-2.5 rounded-full", col.color)} />{col.label}
          </span>
        ))}
        <div className="ml-auto" />
      </div>

      {/* Timeline chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Month header */}
            <div className="relative h-8 border-b border-gray-100 bg-gray-50/60 flex">
              <div className="w-[200px] shrink-0 border-r border-gray-200/50 bg-gray-50" />
              <div className="flex-1 relative">
                {monthLabels.map((m, i) => (
                  <div key={i} className="absolute top-0 h-full flex items-center" style={{ left: `${m.pct}%` }}>
                    <span className="text-xs font-semibold text-gray-500 px-2 whitespace-nowrap pl-2 border-l border-gray-300/50 h-4 flex items-center">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Day header (abbreviated) */}
            <div className="relative h-7 border-b border-gray-100 bg-gray-50/40 flex">
              <div className="w-[200px] shrink-0" />
              <div className="flex-1 relative">
                {days.map((d, i) => (
                  <div key={i} className="absolute top-0 h-full flex items-center" style={{ left: `${dayPct(d)}%` }}>
                    <span className={cn("text-[10px] font-medium px-1", d.toDateString() === today.toDateString() ? "text-blue-600" : "text-gray-400")}>
                      {d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))}
                {/* Today line */}
                {todayPct >= 0 && todayPct <= 100 && (
                  <div className="absolute top-0 h-full w-px bg-blue-400 opacity-60" style={{ left: `${todayPct}%` }} />
                )}
              </div>
            </div>

            {/* Task rows */}
            <div className="divide-y divide-gray-50">
              {datedTasks.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).map(task => {
                const duePct = dayPct(dueDateLocal(task.dueDate!));
                const isOverdue = isTaskOverdue(task.dueDate, task.status, today);
                return (
                  <div key={task.id} className="group flex items-center hover:bg-blue-50/30 transition-colors" style={{ minHeight: "48px" }}>
                    {/* Task label */}
                    <div
                      className="w-[200px] shrink-0 px-4 flex items-center gap-2 min-w-0 cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() => onEditTask(task)}
                    >
                      <div className="shrink-0"><TaskStatusIcon status={task.status} dueDate={task.dueDate} /></div>
                      <span className={cn("text-sm font-medium text-gray-700 truncate", task.status === "completed" && "line-through text-gray-400")}>
                        {task.title}
                      </span>
                    </div>
                    {/* Bar area */}
                    <div className="flex-1 relative h-full flex items-center py-2.5">
                      {/* Today line */}
                      {todayPct >= 0 && todayPct <= 100 && (
                        <div className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-40 pointer-events-none" style={{ left: `${todayPct}%` }} />
                      )}
                      {/* Milestone dot */}
                      <div
                        className="absolute cursor-pointer"
                        style={{ left: `calc(${Math.max(0, Math.min(100, duePct))}% - 8px)` }}
                        onClick={() => onEditTask(task)}
                        title={task.title}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-125",
                          isOverdue ? "bg-red-400" : colColor(task.status)
                        )} />
                      </div>
                      {/* Label to the right of dot */}
                      <span
                        className={cn("absolute text-xs font-medium whitespace-nowrap flex items-center gap-1.5", colTextColor(task.status))}
                        style={{ left: `calc(${Math.max(0, Math.min(95, duePct))}% + 14px)` }}
                      >
                        {dueDateLocal(task.dueDate!).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                        <OverduePill dueDate={task.dueDate} status={task.status} />
                      </span>
                    </div>
                  </div>
                );
              })}

              {datedTasks.length === 0 && (
                <div className="flex items-center" style={{ minHeight: "80px" }}>
                  <div className="w-[200px] shrink-0 px-4 text-sm text-gray-400 italic">No due dates set</div>
                  <div className="flex-1 relative h-full flex items-center justify-center py-4">
                    <p className="text-sm text-gray-400">Add due dates to tasks to see them on the timeline.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Undated tasks list */}
      {undatedTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasks without due dates ({undatedTasks.length})</span>
          </div>
          <div className="divide-y divide-gray-50">
            {undatedTasks.map(task => (
              <div key={task.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-blue-50/30 transition-colors cursor-pointer" onClick={() => onEditTask(task)}>
                <div className="shrink-0"><TaskStatusIcon status={task.status} dueDate={task.dueDate} /></div>
                <span className="text-sm font-medium text-gray-700 flex-1 truncate">{task.title}</span>
                <StatusBadge status={task.status} />
                <MoreHorizontal className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface TasksPageProps { workspaceId?: string; }

export default function TaskBoard({ workspaceId }: TasksPageProps) {
  const { workspaces } = useWorkspaces();
  const token  = getToken();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const router = useRouter();

  const [tasks, setTasks]   = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState("Board");
  const [loading, setLoading]   = useState(true);
  const [error, setError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const orderPending = useRef(false);
  const [reload, setReload] = useState(0);

  // DnD
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Dialogs
  const [showCreate, setShowCreate]         = useState(false);
  const [newTaskStatus, setNewTaskStatus]   = useState("todo");
  const [editingTask, setEditingTask]       = useState<Task | null>(null);

  // Workspace header
  const [workspaceName, setWorkspaceName]   = useState("");
  const displayedWorkspaceName = workspaces.find(workspace => workspace.id === workspaceId)?.name ?? workspaceName;
  const [isRenaming, setIsRenaming]         = useState(false);
  const [newName, setNewName]               = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!token || !workspaceId) return;
    const controller = new AbortController();
    Promise.all([
      api<Task[]>(`/api/tasks?workspaceId=${encodeURIComponent(workspaceId)}`, { token, signal: controller.signal }),
      api<{ name: string }>(`/api/workspaces/${workspaceId}`, { token, signal: controller.signal }),
    ]).then(([data, workspace]) => {
      if (controller.signal.aborted) return;
      setTasks(data);
      setWorkspaceName(workspace.name);
      setNewName(workspace.name);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load workspace.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, workspaceId, reload]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (orderPending.current || showCreate || editingTask) return;
    setActiveTask(tasks.find(t => t.id === active.id) ?? null);
  };
  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    if (!over || !token || orderPending.current || showCreate || editingTask) return;
    const previous = tasks;
    const next = moveTask(tasks, String(active.id), String(over.id));
    if (next === tasks) return;
    orderPending.current = true;
    setSavingOrder(true);
    setError("");
    setTasks(next);
    try {
      const saved = await api<Task[]>(`/api/tasks/${active.id}/move`, { method: "PUT", token, body: { overId: String(over.id) } });
      setTasks(saved);
    } catch (error) {
      setTasks(previous);
      setError(error instanceof Error ? error.message : "Unable to save task order.");
    } finally {
      orderPending.current = false;
      setSavingOrder(false);
    }
  };

  // CRUD
  const handleCreateTask = async (data: { title: string; description: string; status: string; priority: string; dueDate?: string }) => {
    if (!token || !workspaceId) return;
    const created = await api<Task>("/api/tasks", { method: "POST", token, body: { ...data, workspaceId } });
    setTasks(prev => [created, ...prev]);
    setShowCreate(false);
  };
  const handleUpdateTask = async (updated: Partial<Task>) => {
    if (!token || !editingTask) return;
    const saved = await api<Task>(`/api/tasks/${editingTask.id}`, { method: "PUT", token, body: updated });
    setTasks(prev => prev.map(t => t.id === saved.id ? saved : t));
  };
  const handleDeleteTask = async () => {
    if (!token || !editingTask) return;
    await api(`/api/tasks/${editingTask.id}`, { method: "DELETE", token });
    setTasks(prev => prev.filter(t => t.id !== editingTask.id));
  };

  const handleRename = async () => {
    if (!token || !workspaceId || !newName.trim() || workspaceBusy) return;
    setWorkspaceBusy(true);
    setError("");
    try {
      await api(`/api/workspaces/${workspaceId}`, { method: "PUT", token, body: { name: newName.trim() } });
      setWorkspaceName(newName.trim()); setIsRenaming(false);
      window.dispatchEvent(new Event("workspace-updated"));
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to rename workspace."); }
    finally { setWorkspaceBusy(false); }
  };
  const handleDeleteWorkspace = async () => {
    if (!token || !workspaceId || workspaceBusy || orderPending.current) return;
    setWorkspaceBusy(true);
    setError("");
    try {
      await api(`/api/workspaces/${workspaceId}`, { method: "DELETE", token });
      window.dispatchEvent(new Event("workspace-updated")); router.push("/workspaces");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to delete workspace."); setShowDeleteDialog(false); }
    finally { setWorkspaceBusy(false); }
  };

  const openCreate = (status: string) => { if (orderPending.current) return; setNewTaskStatus(status); setShowCreate(true); };
  const openEdit = (task: Task) => { if (!orderPending.current) setEditingTask(task); };
  const getTasksForColumn = (colId: string) => tasks.filter(t => t.status === colId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));

  if (!workspaceId) return <div className="p-8 text-gray-500">Please select a workspace.</div>;

  const dropAnimation: DropAnimation = { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) };

  return (
    <BoardTime.Provider value={now}><DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveTask(null)}>
      <div className="min-h-screen p-6 md:p-8 font-sans text-gray-900">

        {/* ── Header ── */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-1">
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <Input aria-label="Workspace name" value={newName} onChange={e => setNewName(e.target.value)} className="text-2xl font-bold h-10 rounded-xl" autoFocus onKeyDown={e => e.key === "Enter" && handleRename()} />
                <Button disabled={workspaceBusy} onClick={handleRename} size="sm" className="bg-blue-600 text-white rounded-xl">Save</Button>
                <Button onClick={() => setIsRenaming(false)} size="sm" variant="ghost" className="rounded-xl">Cancel</Button>
              </div>
            ) : (
              <h1 onClick={() => { setNewName(displayedWorkspaceName); setIsRenaming(true); }} className="text-2xl md:text-3xl font-bold text-gray-900 cursor-pointer hover:bg-gray-100 rounded-xl px-2 py-1 -ml-2 transition-colors group flex items-center gap-2" title="Click to rename">
                {displayedWorkspaceName || "Workspace"}
                <Pencil className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm border border-red-100">Delete workspace</Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined} className="max-w-sm rounded-2xl p-0 overflow-hidden border border-gray-100 shadow-xl" showCloseButton={false}>
                <div className="h-1.5 bg-red-500 w-full" />
                <div className="px-6 py-5 space-y-4">
                  <DialogHeader><DialogTitle className="text-gray-900">Delete &quot;{displayedWorkspaceName}&quot;?</DialogTitle></DialogHeader>
                  <p className="text-sm text-gray-500 leading-relaxed">This will permanently delete the workspace and all its tasks. This action cannot be undone.</p>
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <Button variant="ghost" onClick={() => setShowDeleteDialog(false)} className="rounded-xl">Cancel</Button>
                    <Button disabled={workspaceBusy || savingOrder} variant="destructive" onClick={handleDeleteWorkspace} className="rounded-xl">Delete forever</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-sm text-gray-400 ml-0.5">Manage and organise your tasks</p>
        </header>

        {/* ── View mode tabs ── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex max-w-full flex-wrap bg-gray-100 p-1 rounded-xl gap-1">
            {VIEW_MODES.map(({ id, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className={cn("flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all", viewMode === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
              >
                <Icon className="h-3.5 w-3.5" />
                {id}
              </button>
            ))}
          </div>

          {/* Quick add for non-board views */}
          {viewMode !== "Board" && (
            <Button onClick={() => openCreate("todo")} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-1.5">
              <Plus className="h-4 w-4" /> New task
            </Button>
          )}
        </div>

        {error && <div role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error} <button className="underline" onClick={() => { setLoading(true); setError(""); setReload(value => value + 1); }} disabled={savingOrder}>Retry</button></div>}
        {savingOrder && <p role="status" className="mb-3 text-sm text-gray-500">Saving task order…</p>}
        {/* ── Content ── */}
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-blue-500 h-8 w-8" /></div>
        ) : (
          <>
            {viewMode === "Board" && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                {COLUMNS.map(col => (
                  <TaskColumn key={col.id} col={col} tasks={getTasksForColumn(col.id)} onAddTask={openCreate} onEditTask={openEdit} />
                ))}
              </div>
            )}
            {viewMode === "List" && (
              <ListView tasks={tasks} onEditTask={openEdit} onAddTask={openCreate} />
            )}
            {viewMode === "Table" && (
              <TableView tasks={tasks} onEditTask={openEdit} onAddTask={openCreate} />
            )}
            {viewMode === "Timeline" && (
              <TimelineView tasks={tasks} onEditTask={openEdit} onAddTask={openCreate} />
            )}
          </>
        )}

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? <TaskCard task={activeTask} /> : null}
        </DragOverlay>
      </div>

      {showCreate && <CreateTaskDialog open={showCreate} onClose={() => setShowCreate(false)} initialStatus={newTaskStatus} onCreate={handleCreateTask} />}
      {editingTask && (
        <EditTaskDialog key={editingTask.id} task={editingTask} open={!!editingTask} onClose={() => setEditingTask(null)} onSave={handleUpdateTask} onDelete={handleDeleteTask} />
      )}
    </DndContext></BoardTime.Provider>
  );
}
