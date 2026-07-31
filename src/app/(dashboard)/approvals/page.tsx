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
import { actorDisplayName, getCurrentActor } from "@/lib/auth/current-actor";
import { getApprovalsOverview } from "@/lib/approvals/store";
import {
  formatSignatureShort,
  signatureAlgorithm,
  stepSignaturePayload,
  verifySignature,
} from "@/lib/approvals/signature";
import { authorizeApprovalAction } from "@/lib/approvals/transitions";
import {
  chainProgressPercent,
  completedSteps,
  currentStage,
  WORKFLOW_ACTIONS,
  WORKFLOW_STAGES,
  countByStage,
  type ApprovalInstance,
  type WorkflowAction,
  type WorkflowInstanceStatus,
} from "@/lib/approvals/types";
import { ApprovalDecisionForm } from "./approval-decision-form";

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
 * The chain is advanced by the Server Action in `./actions.ts`. Which buttons a
 * chain offers is decided by running the real authorisation function
 * (`authorizeApprovalAction`) once per candidate action, so the UI cannot present
 * a decision the server would refuse — and the server re-checks anyway, since the
 * action is a POST endpoint reachable without this page.
 *
 * Persistence is worth stating plainly: there is no database. Decisions are
 * written to the in-memory store in `src/lib/approvals/store.ts`, so they survive
 * between requests to the same server process and no further. The page says so.
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

    // Rebuilt with `stepSignaturePayload`, the same builder that produced the
    // payload when the step was signed. That shared builder is what makes the
    // badge meaningful: an earlier version of this page reconstructed the signer
    // from a fixture lookup, which would have reported "invalid" for every step a
    // Server Action legitimately signed.
    const payload = stepSignaturePayload(instance, step);
    if (payload === null) {
      // A stored signature we cannot rebuild a payload for cannot be checked.
      // Reporting "verified" would be the worst possible default.
      results.set(step.stepNumber, { state: "invalid", signerName: step.signerName });
      continue;
    }

    const valid = await verifySignature(step.digitalSignature, payload);
    results.set(step.stepNumber, {
      state: valid ? "verified" : "invalid",
      signerName: step.signerName,
    });
  }

  return results;
}

export default async function ApprovalsPage() {
  const t = await getTranslations("approvals");
  const tComments = await getTranslations("approval_comments");
  const locale = await getLocale();

  const tRoles = await getTranslations("user_roles");
  const tActor = await getTranslations("actor");

  const overview = await getApprovalsOverview();
  const { instances } = overview;

  const actor = await getCurrentActor();

  const counts = countByStage(instances);
  const algorithm = signatureAlgorithm();

  /**
   * Decisions this actor may take on this instance, derived by asking the same
   * authorisation function the Server Action will ask. Deriving the buttons from
   * the rule rather than restating the rule in the UI is what keeps the two from
   * disagreeing — a button that leads to a refusal is worse than no button.
   */
  const allowedActionsFor = (instance: ApprovalInstance): WorkflowAction[] =>
    actor === null
      ? []
      : WORKFLOW_ACTIONS.filter((action) => authorizeApprovalAction(actor, instance, action).ok);

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
          {/* Who the signature will be attributed to, and under which role. Shown
              because it is the answer to "why is that button missing" and because
              a signature attributed to the wrong person is the failure mode this
              whole screen exists to prevent. */}
          <CardDescription data-testid="approval-actor">
            {actor === null
              ? t("errors.unauthenticated")
              : t("acting_as", {
                  name: actorDisplayName(actor, tActor("unauthenticated_operator")),
                  role: tRoles(actor.role),
                })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {instances.map((instance) => {
            const verified = verifications.get(instance.id);
            const stage = currentStage(instance);
            return (
              <div
                key={instance.id}
                className="space-y-3 rounded-md border p-4"
                data-testid="approval-chain"
                // Stable hook for the E2E specs, which need to address one chain
                // without depending on translated text.
                data-record-label={instance.recordLabel}
                data-status={instance.status}
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
                    // Keyed on `currentStep`, not on how many steps are in the
                    // log: an instance returned to the author has two decisions
                    // recorded and nothing settled, and marking the first two
                    // stages done would claim otherwise.
                    const done = index < instance.currentStep;
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

                {/* The decision controls sit under the chain they act on rather
                    than in the list table above: the buttons need room, and the
                    reader needs the history in view while deciding. */}
                <div className="border-t pt-3" data-testid="approval-decision">
                  {stage === null ? (
                    <p className="text-xs text-muted-foreground">{t("decision_closed")}</p>
                  ) : (
                    <ApprovalDecisionForm
                      instanceId={instance.id}
                      stage={stage}
                      allowedActions={allowedActionsFor(instance)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{t("signature_note")}</p>
        <p>{t("returned_note")}</p>
        <p>{t("rejected_note")}</p>
        <p>{t("in_memory_note")}</p>
      </div>
    </div>
  );
}
