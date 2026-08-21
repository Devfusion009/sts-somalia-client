import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { StatementDocument } from "./StatementDocument";
import type { AgencyCommissionEntry } from "@/modules/agencies/queries";

export async function renderCommissionStatementPdf(params: {
  agencyName: string;
  periodLabel: string;
  entries: AgencyCommissionEntry[];
}): Promise<Buffer> {
  return renderToBuffer(
    <StatementDocument
      agencyName={params.agencyName}
      periodLabel={params.periodLabel}
      entries={params.entries}
    />
  );
}
