import { format } from "date-fns";
import { MessagesSquare } from "lucide-react";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  author_kind: string;
  author_name: string | null;
  body: string;
  created_at: string;
};

/**
 * One conversation, two perspectives: "mine" is right-aligned. Staff see the
 * applicant's side on the left; the applicant sees STS on the left.
 */
export function MessageThread({ messages, viewer }: { messages: Message[]; viewer: "staff" | "customer" }) {
  if (messages.length === 0) {
    return (
      <Empty className="p-6 md:p-8">
        <EmptyMedia variant="icon">
          <MessagesSquare />
        </EmptyMedia>
        <EmptyTitle>No messages</EmptyTitle>
      </Empty>
    );
  }

  return (
    <ol className="space-y-3">
      {messages.map((m) => {
        const mine = viewer === "staff" ? m.author_kind === "staff" : m.author_kind !== "staff";
        const who = m.author_kind === "staff" ? (viewer === "staff" ? (m.author_name ?? "STS") : "STS Somalia") : (m.author_name ?? "Applicant");
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary text-foreground"
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p
                className={cn(
                  "mt-1 text-xs tabular-nums",
                  mine ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              >
                {who} · {format(new Date(m.created_at), "d MMM, HH:mm")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
