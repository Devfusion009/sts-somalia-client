import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FilePlus2,
  FileSearch,
  Info,
  Settings2,
  Send,
  XCircle,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getApplicationDetail,
  getOrderForVisaApplication,
} from "@/modules/visa/queries";
import { VISA_STATUS_LABELS } from "@/modules/visa/schemas";
import { countryFlag, countryName } from "@/lib/countries";
import { VisaStatusBadge, fmtMoney } from "@/modules/visa/components/visa-shared";
import { ApplicationSummary } from "@/modules/visa/components/application-summary";
import { RequestUpload } from "@/modules/visa/components/request-upload";
import { ReplaceUpload } from "@/modules/visa/components/replace-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Visa Application Tracking" };

const TIMELINE_STAGES = [
  { key: "submitted", label: "Application Submitted", icon: Send },
  { key: "in_review", label: "Under Review", icon: FileSearch },
  { key: "additional_info_required", label: "Additional Documents", icon: FilePlus2 },
  { key: "processing", label: "Under Processing", icon: Settings2 },
  { key: "decision", label: "Decision", icon: CheckCircle2 },
] as const;

function stageIndexForStatus(status: string) {
  switch (status) {
    case "submitted":
      return 0;
    case "in_review":
      return 1;
    case "additional_info_required":
      return 2;
    case "processing":
      return 3;
    case "approved":
    case "rejected":
    case "issued":
    case "cancelled":
      return 4;
    default:
      return 0;
  }
}

export default async function VisaTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const application = await getApplicationDetail(id);
  if (!application || !application.visa_type) notFound();
  const visaType = application.visa_type;
  const order = await getOrderForVisaApplication(application.id);

  const decided = ["approved", "rejected", "issued"].includes(application.status);
  const approved = application.status === "approved" || application.status === "issued";
  const stageIndex = stageIndexForStatus(application.status);
  const hadDocRequests = application.document_requests.length > 0;
  const stages = TIMELINE_STAGES.filter(
    (s) => s.key !== "additional_info_required" || hadDocRequests
  );
  const currentStageIdx = Math.min(
    stages.length - 1,
    stages.reduce(
      (acc, s, i) => (TIMELINE_STAGES.findIndex((t) => t.key === s.key) <= stageIndex ? i : acc),
      0
    )
  );

  const resultDoc = application.documents.find((d) => d.document_type === "visa_result");
  let resultUrl: string | null = null;
  if (resultDoc) {
    const supabase = await createClient();
    const { data: signed } = await supabase.storage
      .from("visa-documents")
      .createSignedUrl(resultDoc.storage_path, 60 * 60);
    resultUrl = signed?.signedUrl ?? null;
  }

  const rejectedDocs = application.documents.filter((d) => d.review_status === "rejected");
  const traveler = (application.traveler_details ?? {}) as Record<string, string>;

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-4xl leading-none">
              {countryFlag(visaType.destination_country_code)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-bold">
                {countryName(visaType.destination_country_code)}
              </h1>
              <p className="truncate text-sm text-muted-foreground">{visaType.name}</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Application Reference</p>
            <p className="font-mono text-sm font-semibold text-foreground">{application.application_ref}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Submitted On</p>
            <p className="text-sm font-semibold text-foreground">
              {format(new Date(application.created_at), "dd MMM yyyy, hh:mm a")}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Current Status</p>
              <VisaStatusBadge status={application.status} className="mt-0.5" />
            </div>
          </div>
        </div>
      </div>

      {order && order.status === "pending_payment" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4 text-brand-gold" />
            Payment is pending — your application will be processed once payment is received.
          </p>
          <Button size="sm" className="gap-1.5" render={<Link href={`/checkout/${order.id}`} />}>
            Complete Payment ({fmtMoney(order.total, order.currency)}) <ArrowRight className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_310px]">
        <div className="space-y-6">
          {/* Progress tracker */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex items-start">
                {stages.map((stage, i) => {
                  const reached = i <= currentStageIdx;
                  const isLast = i === stages.length - 1;
                  const isDecision = stage.key === "decision";
                  const Icon = isDecision
                    ? approved || !decided
                      ? CheckCircle2
                      : XCircle
                    : stage.icon;
                  const label = isDecision
                    ? decided
                      ? (VISA_STATUS_LABELS[application.status] ?? "Decision")
                      : "Decision"
                    : stage.label;
                  const decisionColor =
                    isDecision && decided
                      ? approved
                        ? "bg-primary text-primary-foreground"
                        : "bg-destructive text-destructive-foreground"
                      : null;
                  return (
                    <li key={stage.key} className={cn("relative flex-1", !isLast && "pr-2")}>
                      {!isLast ? (
                        <span
                          aria-hidden
                          className={cn(
                            "absolute top-5 right-0 left-[calc(50%+22px)] h-0.5",
                            i < currentStageIdx ? "bg-primary" : "bg-border"
                          )}
                        />
                      ) : null}
                      <div className="flex flex-col items-center gap-2 text-center">
                        <span
                          className={cn(
                            "flex size-10 items-center justify-center rounded-full border-2",
                            decisionColor
                              ? `border-transparent ${decisionColor}`
                              : reached
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-muted-foreground"
                          )}
                        >
                          <Icon className="size-4.5" />
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            reached ? "" : "text-muted-foreground"
                          )}
                        >
                          {label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {decided ? (
                <div
                  className={cn(
                    "mt-6 flex items-start gap-2.5 rounded-xl px-4 py-3.5 text-sm",
                    approved ? "bg-primary/10 text-foreground" : "bg-destructive/10"
                  )}
                >
                  {approved ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {approved
                        ? "Congratulations! Your visa has been approved."
                        : "Unfortunately, your application has been rejected."}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {approved
                        ? `Your visa is valid ${visaType.validity_days ? `for ${visaType.validity_days} days ` : ""}from the date of issue. Please check your email for more details.`
                        : (application.admin_notes ??
                          "Contact our support team to understand the reason and next steps.")}
                    </p>
                  </div>
                </div>
              ) : null}

              {approved ? (
                <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-border p-4 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    [
                      "Decision Date",
                      application.decided_at
                        ? format(new Date(application.decided_at), "dd MMM yyyy")
                        : "—",
                    ],
                    ["Visa Validity", visaType.validity_days ? `${visaType.validity_days} Days` : "—"],
                    ["Stay Period", visaType.stay_days ? `${visaType.stay_days} Days` : "—"],
                    ["Entries", visaType.entry_type === "multiple" ? "Multiple" : "Single Entry"],
                    ["Passport Number", traveler.passport_number ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
                      <p className={cn("mt-0.5 text-sm", value === "—" ? "text-muted-foreground/50" : "font-semibold text-foreground")}>{value}</p>
                    </div>
                  ))}
                  <div className="col-span-full">
                    {resultUrl ? (
                      <Button className="gap-2" render={<a href={resultUrl} download />}>
                        <Download className="size-4" /> Download Visa
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {order && order.paid > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border text-sm">
                  <div className="flex items-center justify-between py-2 first:pt-0">
                    <dt className="text-muted-foreground">Visa fee</dt>
                    <dd className="font-medium">{fmtMoney(order.subtotal, order.currency)}</dd>
                  </div>
                  {Number(order.fee_total) > 0 ? (
                    <div className="flex items-center justify-between py-2">
                      <dt className="text-muted-foreground">Processing fee</dt>
                      <dd className="font-medium">{fmtMoney(order.fee_total, order.currency)}</dd>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between py-2">
                    <dt className="font-medium">Total</dt>
                    <dd className="font-semibold">{fmtMoney(order.total, order.currency)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted-foreground">Paid{order.method ? ` — ${order.method}` : ""}</dt>
                    <dd className="font-medium">{fmtMoney(order.paid, order.currency)}</dd>
                  </div>
                  {order.remaining > 0 ? (
                    <div className="flex items-center justify-between py-2 last:pb-0">
                      <dt className="text-muted-foreground">Balance due</dt>
                      <dd className="font-medium">{fmtMoney(order.remaining, order.currency)}</dd>
                    </div>
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {/* Additional documents */}
          {application.document_requests.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Need to Add or Update Documents?</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {application.document_requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <p className="font-medium">{request.title}</p>
                          {request.description ? (
                            <p className="text-xs text-muted-foreground">{request.description}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "border-transparent capitalize",
                              request.status === "requested"
                                ? request.requirement === "optional"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-brand-gold/15 text-brand-gold"
                                : "bg-primary/10 text-primary"
                            )}
                          >
                            {request.status === "requested" && request.requirement === "optional"
                              ? "Optional"
                              : request.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {request.status === "requested" ? (
                            <div className="flex justify-end">
                              <RequestUpload
                                requestId={request.id}
                                applicationId={application.id}
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {request.status === "uploaded" ? "Awaiting review" : "Completed"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {rejectedDocs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documents to replace</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {rejectedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">
                        {doc.document_type.replace(/_/g, " ").replace("request:", "requested: ")}
                      </p>
                      <p className="mt-0.5 text-xs text-destructive">{doc.rejection_reason}</p>
                    </div>
                    <ReplaceUpload documentId={doc.id} applicationId={application.id} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Tracking details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tracking Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date &amp; Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {application.history.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {format(new Date(event.created_at), "dd MMM yyyy hh:mm a")}
                      </TableCell>
                      <TableCell>
                        <VisaStatusBadge status={event.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.note ?? defaultHistoryNote(event.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-chart-3/10 px-4 py-2.5 text-xs">
                <Info className="size-3.5 shrink-0 text-chart-3" />
                If you have any questions, please contact our support team.
              </p>
            </CardContent>
          </Card>

          <p className="flex items-center gap-2 rounded-xl bg-brand-gold/10 px-4 py-3 text-xs text-muted-foreground">
            <Clock3 className="size-3.5 shrink-0 text-brand-gold" />
            The final decision is made by the {countryName(visaType.destination_country_code)}{" "}
            immigration authority.
          </p>
        </div>

        <ApplicationSummary
          application={application}
          priceLabel={order?.status === "paid" ? "Total Fee Paid" : "Total Fee"}
        />
      </div>
    </div>
  );
}

function defaultHistoryNote(status: string) {
  switch (status) {
    case "draft":
      return "Application started.";
    case "submitted":
      return "Your application has been successfully submitted.";
    case "in_review":
      return "Your application is under review by the immigration officer.";
    case "additional_info_required":
      return "Additional documents were requested.";
    case "processing":
      return "Your application is being processed.";
    case "approved":
      return "Your visa application has been approved.";
    case "issued":
      return "Your visa has been issued.";
    case "rejected":
      return "Your visa application has been rejected.";
    case "cancelled":
      return "The application was cancelled.";
    default:
      return "";
  }
}
