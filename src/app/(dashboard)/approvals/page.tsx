import { getLocale, getTranslations } from "next-intl/server";
import { KPICard } from "@/components/features/kpi-card";
import { SampleDataNotice } from "@/components/features/sample-data-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getApprovalsOverview,
  sampleSignaturePayload,
  sampleSignerId,
  sampleSignerName,
} from "@/lib/approvals/sample-data";
import {
  formatSignatureShort,
  signatureAlgorithm,
  verifySignature,
} from "@/lib/approvals/signature";
import {
  chainProgressPercent,
  completedSteps,
  currentStage,
  WORKFLOW_STAGES,
  countByStage,
  type ApprovalInstance,
  type WorkflowInstanceStatus,
} from "@/lib/approvals/types";

/**
 * Approval workflow, served at `/approvals`.
 *
 * A Server Component covering the four-stage chain the product promises:
 * 작성자 → 검토자 → 승인자 → 최종확정, each stage carrying a digital signature.
 *
 * The signature badge is not decorative. Every rendered signature is actually
 * re-verified here against a payload rebuilt from the instance's own fields, so
 * if the emission figure on a record were edited after sign-off the badge would
 * go red. That is only meaningful because signing and verifying share one
 * payload builder (`sampleSignaturePayload`); two copies would drift and the
 * badge would silently lie.
 *
 * Verification runs on the server, which is also where the signing key lives, so
 * an HMAC signature stays verifiable without shipping the key to the browser.
 *
 * Scope limit worth stating plainly: this page is read-only. `isActionAllowed`
 * in the library layer encodes which action each stage may take, but no Server
 * Action is wired up yet, so nothing here can advance a chain.
 */

const STATUS_VARIANT: Record<
  WorkflowInstanceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  in_progress: "secondary",
  approved: "default",
  rejected: "destructive",
};

/** Signature verification outcome for one step. */
type SignatureState = "verified" | "invalid" | "pending";

/**
 * Re-verifies every signed step of an instance.
 *
 * Returns a map keyed by step number rather than mutating the steps, so the
 * provider's payload stays the single source of what was stored.
 */
async function verifyInstance(
  instance: ApprovalInstance
): Promise<Map<number, { state: SignatureState; signerName: string | null }>> {
  const results = new Map<number, { state: SignatureState; signerName: string | null }>();

  for (const step of instance.steps) {
    if (step.digitalSignature === null || step.completedAt === null) {
      results.set(step.stepNumber, { state: "pending", signerName: null });
      continue;
    }

    const signerId = sampleSignerId(instance.id, step.stepNumber);
    if (signerId === null) {
      // A stored signature we cannot attribute to a signer cannot be checked.
      // Reporting "verified" would be the worst possible default.
      results.set(step.stepNumber, { state: "invalid", signerName: null });
      continue;
    }

    const payload = sampleSignaturePayload(instance, step, signerId);
    const valid = await verifySignature(step.digitalSignature, payload);
    results.set(step.stepNumber, {
      state: valid ? "verified" : "invalid",
      signerName: sampleSignerName(signerId),
    });
  }

  return results;
}

export default async function ApprovalsPage() {
  const t = await getTranslations("approvals");
  const tComments = await getTranslations("approval_comments");
  const locale = await getLocale();

  const overview = await getApprovalsOverview();
  const { instances } = overview;

  const counts = countByStage(instances);
  const algorithm = signatureAlgorithm();

  const verifications = new Map<string, Awaited<ReturnType<typeof verifyInstance>>>();
  for (const instance of instances) {
    verifications.set(instance.id, await verifyInstance(instance));
  }

  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const dateTimeFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const formatInstant = (iso: string) => dateTimeFormat.format(new Date(iso));

  // Sample data addresses comments by message key; a database-backed provider
  // would return stored free text, which falls through unchanged.
  const commentOf = (key: string | null) =>
    key === null ? t("no_comment") : tComments.has(key) ? tComments(key) : key;

  const stageOf = (instance: ApprovalInstance) => {
    const stage = currentStage(instance);
    return stage === null ? "—" : t(`stages.${stage}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {overview.isSampleData && <SampleDataNotice message={t("sample_data_notice")} />}

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPICard title={t("total")} value={String(counts.total)} />
        <KPICard title={t("awaiting_review")} value={String(counts.awaitingReview)} />
        <KPICard title={t("awaiting_approval")} value={String(counts.awaitingApproval)} />
        <KPICard title={t("returned_count")} value={String(counts.returned)} />
        <KPICard title={t("approved_count")} value={String(counts.approved)} />
        <KPICard title={t("rejected_count")} value={String(counts.rejected)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("list_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("record")}</TableHead>
                <TableHead>{t("summary")}</TableHead>
                <TableHead>{t("period")}</TableHead>
                <TableHead className="text-right">{t("emissions")}</TableHead>
                <TableHead>{t("chain")}</TableHead>
                <TableHead>{t("current_stage")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("updated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((instance) => (
                <TableRow key={instance.id} data-testid="approval-row">
                  <TableCell className="font-mono text-xs font-medium">
                    {instance.recordLabel}
                  </TableCell>
                  <TableCell>{t(`record_summaries.${instance.summaryKey}`)}</TableCell>
                  <TableCell>{instance.period}</TableCell>
                  <TableCell className="text-right">
                    {numberFormat.format(instance.emissions)} {t("unit_tco2e")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {t("chain_progress", {
                      done: completedSteps(instance).length,
                      percent: chainProgressPercent(instance),
                    })}
                  </TableCell>
                  <TableCell>{stageOf(instance)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[instance.status]}>
                      {t(`statuses.${instance.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatInstant(instance.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("chain_title")}</CardTitle>
          <CardDescription>{t("signature_algorithm", { algorithm })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {instances.map((instance) => {
            const verified = verifications.get(instance.id);
            return (
              <div
                key={instance.id}
                className="space-y-3 rounded-md border p-4"
                data-testid="approval-chain"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">
                    <span className="font-mono text-sm">{instance.recordLabel}</span>{" "}
                    <span className="font-normal text-muted-foreground">
                      {t(`record_summaries.${instance.summaryKey}`)}
                    </span>
                  </h2>
                  <Badge variant={STATUS_VARIANT[instance.status]}>
                    {t(`statuses.${instance.status}`)}
                  </Badge>
                </div>

                {/* The full four-stage chain, including stages not yet reached,
                    so the reader can see what is still outstanding rather than
                    only what has happened. */}
                <ol className="flex flex-wrap items-center gap-2 text-xs">
                  {WORKFLOW_STAGES.map((stage, index) => {
                    const done = index < completedSteps(instance).length;
                    return (
                      <li key={stage} className="flex items-center gap-2">
                        <span
                          className={
                            done
                              ? "rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary"
                              : "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                          }
                        >
                          {index + 1}. {t(`stages.${stage}`)}
                        </span>
                        {index < WORKFLOW_STAGES.length - 1 && (
                          <span aria-hidden="true" className="text-muted-foreground">
                            →
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("stage")}</TableHead>
                      <TableHead>{t("assignee")}</TableHead>
                      <TableHead>{t("action")}</TableHead>
                      <TableHead>{t("comment")}</TableHead>
                      <TableHead>{t("completed_at")}</TableHead>
                      <TableHead>{t("signature")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instance.steps.map((step) => {
                      const result = verified?.get(step.stepNumber);
                      const state: SignatureState = result?.state ?? "pending";
                      return (
                        <TableRow key={step.stepNumber} data-testid="approval-step">
                          <TableCell>
                            {step.stepNumber + 1}. {t(`stages.${step.stage}`)}
                          </TableCell>
                          <TableCell>
                            {step.assigneeNameKey ? t(`roles.${step.assigneeNameKey}`) : "—"}
                            {result?.signerName && (
                              <div className="text-xs text-muted-foreground">
                                {result.signerName}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {step.action === null ? (
                              <span className="text-xs text-muted-foreground">{t("awaiting")}</span>
                            ) : (
                              t(`actions.${step.action}`)
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {commentOf(step.commentKey)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {step.completedAt === null ? "—" : formatInstant(step.completedAt)}
                          </TableCell>
                          <TableCell>
                            {step.digitalSignature === null ? (
                              <span className="text-xs text-muted-foreground">
                                {t("signature_pending")}
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <Badge
                                  variant={state === "verified" ? "default" : "destructive"}
                                  data-testid="signature-badge"
                                >
                                  {state === "verified"
                                    ? t("signature_verified")
                                    : t("signature_invalid")}
                                </Badge>
                                <div className="font-mono text-[10px] text-muted-foreground">
                                  {formatSignatureShort(step.digitalSignature)}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{t("signature_note")}</p>
        <p>{t("returned_note")}</p>
        <p>{t("rejected_note")}</p>
        <p>{t("readonly_note")}</p>
      </div>
    </div>
  );
}
