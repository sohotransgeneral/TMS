"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  rectIntersection,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LoadStatusBadge } from "@/components/loads/load-status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CockpitLoad = {
  id: string;
  referenceNumber: string;
  status: string;
  pickupDate: string | null;
  pickupCity: string | null;
  pickupAddress: string;
  deliveryCity: string | null;
  deliveryAddress: string;
  price: number;
  currency: string;
  customer: { name: string } | null;
  driver: { user: { name: string | null } } | null;
  truck: { plateNumber: string } | null;
};

export type CockpitColumn = {
  key: string;
  statuses: string[];
};

// ─── Sortable Load Card ────────────────────────────────────────────────────────

function LoadCard({
  load,
  overlay = false,
}: {
  load: CockpitLoad;
  overlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: load.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const card = (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-dnd-draggable="true"
      className={`rounded-md border bg-card p-3 text-sm shadow-sm select-none cursor-grab active:cursor-grabbing ${
        overlay
          ? "ring-2 ring-primary shadow-xl rotate-1"
          : "hover:border-primary transition-colors"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{load.referenceNumber}</span>
        <LoadStatusBadge status={load.status} />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {load.pickupCity ?? load.pickupAddress} →{" "}
        {load.deliveryCity ?? load.deliveryAddress}
      </div>
      <div className="mt-2 text-xs">🗓 {formatDate(load.pickupDate, true)}</div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span>
          {load.driver?.user.name ?? "—"}
          {load.truck && ` · ${load.truck.plateNumber}`}
        </span>
        <span className="font-medium tabular-nums">
          {formatCurrency(load.price, load.currency)}
        </span>
      </div>
      {load.customer && (
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {load.customer.name}
        </div>
      )}
    </div>
  );

  // When overlay just show the card without the Link (dragging state)
  if (overlay) return card;

  return (
    <Link
      href={`/dispatch/loads/${load.id}`}
      onClick={(e) => {
        // Prevent navigation when drag ends
        if (isDragging) e.preventDefault();
      }}
    >
      {card}
    </Link>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({
  col,
  loads,
  isOver,
}: {
  col: CockpitColumn;
  loads: CockpitLoad[];
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: col.key });

  return (
    <div
      className={`flex flex-col rounded-lg border transition-colors ${
        isOver ? "border-primary bg-primary/5" : "bg-muted/30"
      }`}
    >
      {/* Header */}
      <div className="border-b bg-background/60 px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{col.key}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {loads.length}
          </span>
        </div>
      </div>

      {/* Drop zone / cards */}
      <SortableContext
        items={loads.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="flex-1 space-y-2 p-2 min-h-[80px]">
          {loads.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Empty — drop here
            </p>
          ) : (
            loads.map((l) => <LoadCard key={l.id} load={l} />)
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function CockpitBoard({
  initialLoads,
  columns,
}: {
  initialLoads: CockpitLoad[];
  columns: CockpitColumn[];
}) {
  const [loads, setLoads] = useState(initialLoads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnKey, setOverColumnKey] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Use pointer-within first (best for large empty columns), fall back to rect intersection
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) return pointer;
    return rectIntersection(args);
  }, []);

  /** Map each load id → which column it's in */
  const loadToColumn = useCallback(
    (id: string): CockpitColumn | undefined => {
      const load = loads.find((l) => l.id === id);
      if (!load) return undefined;
      return columns.find((col) => col.statuses.includes(load.status));
    },
    [loads, columns],
  );

  /** Map a column key → first status in that column (target status on drop) */
  const firstStatusOf = (colKey: string) =>
    columns.find((c) => c.key === colKey)?.statuses[0] ?? "";

  function getColumnForLoad(loadId: string): CockpitColumn | undefined {
    return loadToColumn(loadId);
  }

  function getColumnForOverId(overId: string): CockpitColumn | undefined {
    // overId is either a load id or a column key
    const asCol = columns.find((c) => c.key === overId);
    if (asCol) return asCol;
    return loadToColumn(overId);
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragOver({ over }: { over: DragEndEvent["over"] }) {
    if (!over) {
      setOverColumnKey(null);
      return;
    }
    const col = getColumnForOverId(over.id as string);
    setOverColumnKey(col?.key ?? null);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOverColumnKey(null);
    if (!over) return;

    const sourceCol = getColumnForLoad(active.id as string);
    const destCol = getColumnForOverId(over.id as string);

    if (!sourceCol || !destCol || sourceCol.key === destCol.key) return;

    // Pick the first status of the destination column as the new status
    const newStatus = firstStatusOf(destCol.key);
    if (!newStatus) return;

    // Optimistic update
    setLoads((prev) =>
      prev.map((l) => (l.id === active.id ? { ...l, status: newStatus } : l)),
    );

    try {
      const res = await fetch(`/api/loads/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Load status updated");
    } catch {
      // Rollback
      toast.error("Failed to update load status");
      setLoads(initialLoads);
    }
  }

  const activeLoad = loads.find((l) => l.id === activeId);

  // ── Mouse-drag-to-pan ──────────────────────────────────────────────────────
  const boardRef = useRef<HTMLDivElement>(null);
  const panState = useRef<{ startX: number; scrollLeft: number } | null>(null);

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    // Only pan on middle-button or when not clicking a card (target is the grid itself)
    if (e.button !== 0) return;
    // Don't start pan if the target is a card (has draggable role)
    const el = e.target as HTMLElement;
    if (el.closest("[data-dnd-draggable]")) return;
    panState.current = {
      startX: e.pageX,
      scrollLeft: boardRef.current?.scrollLeft ?? 0,
    };
    document.body.style.userSelect = "none";
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!panState.current || !boardRef.current) return;
    const dx = e.pageX - panState.current.startX;
    boardRef.current.scrollLeft = panState.current.scrollLeft - dx;
  }

  function onMouseUp() {
    panState.current = null;
    document.body.style.userSelect = "";
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={boardRef}
        className="grid grid-flow-col gap-4 overflow-x-auto pb-4 cursor-grab active:cursor-grabbing"
        style={{ gridAutoColumns: "minmax(280px, 1fr)" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {columns.map((col) => {
          const items = col.statuses.flatMap((s) =>
            loads.filter((l) => l.status === s),
          );
          return (
            <Column
              key={col.key}
              col={col}
              loads={items}
              isOver={overColumnKey === col.key}
            />
          );
        })}
      </div>

      {/* Drag overlay — the "ghost" card following the cursor */}
      <DragOverlay>
        {activeLoad ? <LoadCard load={activeLoad} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
