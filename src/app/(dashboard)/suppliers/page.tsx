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
import { getCurrentActor } from "@/lib/auth/current-actor";
import { categoryDefinition } from "@/lib/scope3/categories";
import { SAMPLE_AS_OF } from "@/lib/suppliers/sample-data";
import { getSuppliersOverview } from "@/lib/suppliers/store";
import {
  authorizeSupplierAction,
  SUPPLIER_ACTIONS,
  type SupplierAction,
} from "@/lib/suppliers/transitions";
import {
  aggregateByCategory,
  countRequests,
  isOverdue,
  responseRatePercent,
  type DataRequestStatus,
  type SupplierDataRequest,
  type SupplierStatus,
} from "@/lib/suppliers/types";
import { SupplierDecisionForm } from "./supplier-decision-form";

/**
 * Supply chain supplier portal, served at `/suppliers`.
 *
 * A Server Component covering the four operations the product promises —
 * submission, verification (승인), rejection (반려) and re-request (재요청) — plus
 * the Scope 3 roll-up that follows from them.
 *
 * The roll-up is not a `groupBy`. `aggregateByCategory` enforces two rules that
 * a naive sum gets wrong, and the page renders both sides of them:
 *
 *  - only *verified* submissions feed reported Scope 3; submitted-but-unverified
 *    figures are shown in a separate column so the reader can see what the total
 *    would become without unverified numbers leaking into the reported one;
 *  - a request superseded by a re-request is dropped, so a supplier who was
 *    rejected and then re-submitted is counted once, not twice.
 *
 * Verification, rejection and re-request are wired to the Server Action in
 * `./actions.ts`. Which controls a row offers comes from running the real
 * authorisation function (`authorizeSupplierAction`) once per candidate action, so
 * a verified row offers nothing, a rejected row offers only a re-request, and a
 * rejected row that has already been re-requested offers nothing either — a second
 * live replacement would double-count the supplier. The Server Action re-checks
 * all of it.
 *
 * Persistence, plainly: there is no database. Decisions go to the in-memory store
 * in `src/lib/suppliers/store.ts` and last as long as the server process. The page
 * says so.
 */

const SUPPLIER_STATUS_VARIANT: Record<
  SupplierStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  pending: "secondary",
  inactive: "outline",
};

const REQUEST_STATUS_VARIANT: Record<
  DataRequestStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  sent: "outline",
  in_progress: "secondary",
  submitted: "secondary",
  verified: "default",
  rejected: "destructive",
};

export default async function SuppliersPage() {
  const t = await getTranslations("suppliers");
  const tIndustries = await getTranslations("supplier_industries");
  const tReasons = await getTranslations("supplier_rejection_reasons");
  const tCategories = await getTranslations("scope3_categories");
  const tRoles = await getTranslations("user_roles");
  const locale = await getLocale();

  const overview = await getSuppliersOverview();
  const { suppliers, requests } = overview;

  const actor = await getCurrentActor();

  /**
   * Actions available on one row, from the same authorisation function the Server
   * Action uses. All requests are passed through because refusing a second
   * re-request needs to see the siblings.
   */
  const allowedActionsFor = (request: SupplierDataRequest): SupplierAction[] =>
    actor === null
      ? []
      : SUPPLIER_ACTIONS.filter(
          (action) => authorizeSupplierAction(actor, request, action, requests).ok
        );

  // Overdue is relative to a moment. For sample data that moment has to be the
  // sample's own reference date, or every 2024 due date would read as overdue
  // forever and the "overdue" KPI would carry no information.
  const asOf = overview.isSampleData ? SAMPLE_AS_OF : new Date();

  const counts = countRequests(requests, asOf);
  const aggregates = aggregateByCategory(requests);
  const overallResponseRate = responseRatePercent(requests);

  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const spendFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const formatDate = (iso: string) => dateFormat.format(new Date(iso));

  const supplierName = (supplierId: string) =>
    suppliers.find((supplier) => supplier.id === supplierId)?.name ?? supplierId;

  const requestsFor = (supplierId: string) =>
    requests.filter((request) => request.supplierId === supplierId);

  const categoryName = (number: number) =>
    tCategories(categoryDefinition(number as Parameters<typeof categoryDefinition>[0]).nameKey);

  const verifiedTotal = aggregates.reduce(
    (sum, aggregate) => sum + aggregate.verifiedEmissions,
    0
  );
  const pendingTotal = aggregates.reduce((sum, aggregate) => sum + aggregate.pendingEmissions, 0);

  /** Request ids that were superseded, so the table can label the pair. */
  const supersededIds = new Set(
    requests
      .map((request) => request.supersedesRequestId)
      .filter((id): id is string => id !== null)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {overview.isSampleData && <SampleDataNotice message={t("sample_data_notice")} />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t("total_suppliers")}
          value={String(suppliers.length)}
          description={t("year_label", { year: overview.year })}
        />
        <KPICard title={t("total_requests")} value={String(counts.total)} />
        <KPICard
          title={t("awaiting_verification")}
          value={String(counts.awaitingVerification)}
          description={`${t("awaiting_supplier")}: ${counts.awaitingSupplier}`}
        />
        <KPICard
          title={t("response_rate")}
          value={`${overallResponseRate}%`}
          description={`${t("overdue_count")}: ${counts.overdue}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("aggregate_title")}</CardTitle>
          <CardDescription>{t("aggregate_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-right">#</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead className="text-right">{t("verified_emissions")}</TableHead>
                <TableHead className="text-right">{t("verified_suppliers")}</TableHead>
                <TableHead className="text-right">{t("pending_emissions")}</TableHead>
                <TableHead className="text-right">{t("pending_suppliers")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregates.map((aggregate) => (
                <TableRow key={aggregate.categoryNumber} data-testid="scope3-aggregate-row">
                  <TableCell className="text-right font-mono text-xs">
                    {aggregate.categoryNumber}
                  </TableCell>
                  <TableCell>{categoryName(aggregate.categoryNumber)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {numberFormat.format(aggregate.verifiedEmissions)} {t("unit_tco2e")}
                  </TableCell>
                  <TableCell className="text-right">{aggregate.verifiedSupplierCount}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {numberFormat.format(aggregate.pendingEmissions)} {t("unit_tco2e")}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {aggregate.pendingSupplierCount}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell />
                <TableCell className="font-semibold">{t("aggregate_total")}</TableCell>
                <TableCell className="text-right font-semibold">
                  {numberFormat.format(verifiedTotal)} {t("unit_tco2e")}
                </TableCell>
                <TableCell />
                <TableCell className="text-right text-muted-foreground">
                  {numberFormat.format(pendingTotal)} {t("unit_tco2e")}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("suppliers_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("supplier")}</TableHead>
                <TableHead>{t("industry")}</TableHead>
                <TableHead>{t("country")}</TableHead>
                <TableHead>{t("contact")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("annual_spend")}</TableHead>
                <TableHead className="text-right">{t("requests")}</TableHead>
                <TableHead className="text-right">{t("response_rate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => {
                const own = requestsFor(supplier.id);
                return (
                  <TableRow key={supplier.id} data-testid="supplier-row">
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>
                      {supplier.industryKey && tIndustries.has(supplier.industryKey)
                        ? tIndustries(supplier.industryKey)
                        : (supplier.industryKey ?? "—")}
                    </TableCell>
                    <TableCell>{supplier.country ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {supplier.contactName ?? "—"}
                      {supplier.contactEmail && <div>{supplier.contactEmail}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SUPPLIER_STATUS_VARIANT[supplier.status]}>
                        {t(`statuses.${supplier.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {supplier.annualSpendMillionKrw === null
                        ? "—"
                        : `${spendFormat.format(supplier.annualSpendMillionKrw)} ${t("unit_million_krw")}`}
                    </TableCell>
                    <TableCell className="text-right">{own.length}</TableCell>
                    <TableCell className="text-right">{responseRatePercent(own)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("requests_title")}</CardTitle>
          <CardDescription>
            {t("verified_count")}: {counts.verified} · {t("rejected_count")}: {counts.rejected}
          </CardDescription>
          {/* Who a decision will be attributed to, and why some rows offer no
              controls. */}
          <CardDescription data-testid="supplier-actor">
            {actor === null
              ? t("errors.unauthenticated")
              : t("acting_as", { name: actor.name, role: tRoles(actor.role) })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("supplier")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead>{t("period")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("due_date")}</TableHead>
                <TableHead>{t("submitted_at")}</TableHead>
                <TableHead className="text-right">{t("reported_emissions")}</TableHead>
                <TableHead className="text-right">{t("data_quality")}</TableHead>
                <TableHead>{t("rejection_reason")}</TableHead>
                <TableHead>{t("decision_column")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow
                  key={request.id}
                  data-testid="supplier-request-row"
                  // Stable hook for the E2E specs: every other cell in the row is
                  // translated, so nothing else identifies it across locales.
                  data-request-id={request.id}
                  data-status={request.status}
                >
                  <TableCell className="font-medium">{supplierName(request.supplierId)}</TableCell>
                  <TableCell className="text-xs">
                    {request.categoryNumber}. {categoryName(request.categoryNumber)}
                  </TableCell>
                  <TableCell>{request.period}</TableCell>
                  <TableCell className="space-y-1">
                    <Badge variant={REQUEST_STATUS_VARIANT[request.status]}>
                      {t(`request_statuses.${request.status}`)}
                    </Badge>
                    {request.supersedesRequestId !== null && (
                      <Badge variant="outline">{t("re_request_badge")}</Badge>
                    )}
                    {supersededIds.has(request.id) && (
                      <div className="text-[10px] text-muted-foreground">{t("supersedes")}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(request.dueDate)}
                    {isOverdue(request, asOf) && (
                      <Badge variant="destructive" className="ml-1">
                        {t("overdue_badge")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {request.submittedAt === null
                      ? t("not_submitted")
                      : formatDate(request.submittedAt)}
                    {request.verifiedAt !== null && (
                      <div>{t("decided_at", { date: formatDate(request.verifiedAt) })}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {request.reportedEmissions === null
                      ? "—"
                      : `${numberFormat.format(request.reportedEmissions)} ${t("unit_tco2e")}`}
                  </TableCell>
                  <TableCell className="text-right">
                    {request.dataQuality === null
                      ? "—"
                      : t("quality_scale", { score: request.dataQuality })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {request.rejectionReasonKey === null
                      ? t("none")
                      : tReasons.has(request.rejectionReasonKey)
                        ? tReasons(request.rejectionReasonKey)
                        : request.rejectionReasonKey}
                  </TableCell>
                  <TableCell>
                    <SupplierDecisionForm
                      requestId={request.id}
                      allowedActions={allowedActionsFor(request)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t("in_memory_note")}</p>
    </div>
  );
}
